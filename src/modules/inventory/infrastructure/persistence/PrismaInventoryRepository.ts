import { Prisma, PrismaClient } from '@prisma/client';
import type {
  AlertRecord,
  CreateIngredientInput,
  IngredientRecord,
  InventoryRepository,
  InventorySettingsRecord,
  MovementInput,
  MovementRecord,
  RecipeLineRecord,
  RecipeTarget,
  UpdateIngredientInput,
} from '../../application/ports/InventoryRepository.js';
import {
  IngredientAlreadyExistsError,
  IngredientNotFoundError,
  InventoryBusinessAccessError,
  RecipeIngredientInvalidError,
  RecipeTargetNotFoundError,
} from '../../domain/errors.js';
import { roundQuantity, type StockAlertNotice } from '../../domain/stock.js';
import {
  applyStockChange,
  evaluateStockAlerts,
  loadInventorySettings,
  type Tx,
} from './stockLedger.js';

type IngredientRow = Prisma.IngredientGetPayload<object>;

const toIngredient = (row: IngredientRow): IngredientRecord => ({
  id: row.id,
  name: row.name,
  unit: row.unit,
  stock: row.stock.toNumber(),
  parLevel: row.parLevel.toNumber(),
  lowStockMode: row.lowStockMode,
  lowStockValue: row.lowStockValue?.toNumber() ?? null,
  consumptionAlertPercent: row.consumptionAlertPercent?.toNumber() ?? null,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const toMovement = (row: Prisma.StockMovementGetPayload<object>): MovementRecord => ({
  id: row.id,
  type: row.type,
  quantity: row.quantity.toNumber(),
  stockAfter: row.stockAfter.toNumber(),
  orderId: row.orderId,
  note: row.note,
  createdAt: row.createdAt,
});

export class PrismaInventoryRepository implements InventoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async assertAccess(userId: string, businessId: string) {
    const business = await this.prisma.business.findFirst({
      where: { id: businessId, users: { some: { id: userId } } },
      select: { id: true },
    });
    if (!business) throw new InventoryBusinessAccessError();
  }

  async listIngredients(businessId: string, search?: string) {
    const rows = await this.prisma.ingredient.findMany({
      where: {
        businessId,
        archivedAt: null,
        ...(search ? { name: { contains: search, mode: 'insensitive' as const } } : {}),
      },
      orderBy: { name: 'asc' },
    });
    return rows.map(toIngredient);
  }

  async createIngredient(businessId: string, userId: string, input: CreateIngredientInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const created = await tx.ingredient.create({
          data: {
            businessId,
            name: input.name,
            unit: input.unit,
            parLevel: Math.max(input.parLevel ?? 0, input.initialStock ?? 0),
            lowStockMode: input.lowStockMode ?? 'PERCENT',
            lowStockValue: input.lowStockValue ?? null,
            consumptionAlertPercent: input.consumptionAlertPercent ?? null,
          },
        });
        if (input.initialStock && input.initialStock > 0)
          await applyStockChange(tx, {
            businessId,
            ingredientId: created.id,
            type: 'PURCHASE',
            delta: input.initialStock,
            userId,
            note: 'Stock inicial',
          });
        const fresh = await tx.ingredient.findUniqueOrThrow({ where: { id: created.id } });
        return { ingredient: toIngredient(fresh), notices: [] as StockAlertNotice[] };
      });
    } catch (error) {
      if (isUniqueError(error)) throw new IngredientAlreadyExistsError();
      throw error;
    }
  }

  async updateIngredient(businessId: string, ingredientId: string, input: UpdateIngredientInput) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const result = await tx.ingredient.updateMany({
          where: { id: ingredientId, businessId, archivedAt: null },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.parLevel !== undefined ? { parLevel: input.parLevel } : {}),
            ...(input.lowStockMode !== undefined ? { lowStockMode: input.lowStockMode } : {}),
            ...(input.lowStockValue !== undefined ? { lowStockValue: input.lowStockValue } : {}),
            ...(input.consumptionAlertPercent !== undefined
              ? { consumptionAlertPercent: input.consumptionAlertPercent }
              : {}),
          },
        });
        if (result.count !== 1) throw new IngredientNotFoundError();
        const ingredient = await tx.ingredient.findUniqueOrThrow({ where: { id: ingredientId } });
        // Thresholds changed, so the ingredient may have crossed (or left) one.
        const notices = await evaluateStockAlerts(
          tx,
          businessId,
          [ingredientId],
          await loadInventorySettings(tx, businessId),
        );
        return { ingredient: toIngredient(ingredient), notices };
      });
    } catch (error) {
      if (isUniqueError(error)) throw new IngredientAlreadyExistsError();
      throw error;
    }
  }

  async archiveIngredient(businessId: string, ingredientId: string) {
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.ingredient.updateMany({
        where: { id: ingredientId, businessId, archivedAt: null },
        data: { archivedAt: new Date() },
      });
      if (result.count !== 1) throw new IngredientNotFoundError();
      // An archived ingredient stops being tracked: it leaves recipes and alerts.
      await tx.recipeItem.deleteMany({ where: { ingredientId } });
      await tx.stockAlert.updateMany({
        where: { ingredientId, resolvedAt: null },
        data: { resolvedAt: new Date() },
      });
    });
  }

  async recordMovement(
    businessId: string,
    ingredientId: string,
    userId: string,
    input: MovementInput,
  ) {
    return this.prisma.$transaction(async (tx) => {
      // Locks the row so an adjustment computes its delta from the real current stock.
      const locked = await tx.$queryRaw<{ stock: Prisma.Decimal }[]>`
        SELECT "stock" FROM "Ingredient"
        WHERE "id" = ${ingredientId} AND "businessId" = ${businessId} AND "archivedAt" IS NULL
        FOR UPDATE`;
      if (locked.length !== 1) throw new IngredientNotFoundError();
      const current = new Prisma.Decimal(locked[0]!.stock).toNumber();

      const delta =
        input.type === 'PURCHASE'
          ? input.quantity
          : input.type === 'WASTE'
            ? -input.quantity
            : roundQuantity(input.quantity - current);
      const { ingredient, movement } = await applyStockChange(tx, {
        businessId,
        ingredientId,
        type: input.type,
        delta,
        userId,
        note: input.note,
      });
      let result = ingredient;
      // A purchase that exceeds the reference level becomes the new "full" level,
      // so percentage thresholds work without configuring a par level first.
      if (input.type === 'PURCHASE' && ingredient.stock.greaterThan(ingredient.parLevel))
        result = await tx.ingredient.update({
          where: { id: ingredientId },
          data: { parLevel: ingredient.stock },
        });
      const notices = await evaluateStockAlerts(
        tx,
        businessId,
        [ingredientId],
        await loadInventorySettings(tx, businessId),
      );
      return { ingredient: toIngredient(result), movement: toMovement(movement), notices };
    });
  }

  async listMovements(businessId: string, ingredientId: string, page: number, limit: number) {
    const where = { businessId, ingredientId };
    const [rows, total] = await Promise.all([
      this.prisma.stockMovement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.stockMovement.count({ where }),
    ]);
    return { movements: rows.map(toMovement), total };
  }

  async getRecipe(businessId: string, target: RecipeTarget) {
    await this.assertTarget(this.prisma, businessId, target);
    return this.readRecipe(this.prisma, target);
  }

  async setRecipe(
    businessId: string,
    target: RecipeTarget,
    lines: { ingredientId: string; quantity: number }[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertTarget(tx, businessId, target);
      const ids = [...new Set(lines.map((line) => line.ingredientId))];
      if (ids.length !== lines.length) throw new RecipeIngredientInvalidError();
      const valid = await tx.ingredient.count({
        where: { id: { in: ids }, businessId, archivedAt: null },
      });
      if (valid !== ids.length) throw new RecipeIngredientInvalidError();

      const owner = recipeOwner(target);
      await tx.recipeItem.deleteMany({ where: owner });
      if (lines.length > 0)
        await tx.recipeItem.createMany({
          data: lines.map((line) => ({
            businessId,
            ingredientId: line.ingredientId,
            quantity: line.quantity,
            ...owner,
          })),
        });
      return this.readRecipe(tx, target);
    });
  }

  async getSettings(businessId: string): Promise<InventorySettingsRecord> {
    return loadInventorySettings(this.prisma, businessId);
  }

  async updateSettings(businessId: string, input: Partial<InventorySettingsRecord>) {
    return this.prisma.$transaction(async (tx) => {
      await tx.inventorySettings.upsert({
        where: { businessId },
        create: { businessId, ...input },
        update: input,
      });
      const settings = await loadInventorySettings(tx, businessId);
      // New thresholds may change which ingredients are low, so re-check them all.
      const active = await tx.ingredient.findMany({
        where: { businessId, archivedAt: null },
        select: { id: true },
      });
      const notices = await evaluateStockAlerts(
        tx,
        businessId,
        active.map((row) => row.id),
        settings,
      );
      return { settings, notices };
    });
  }

  async listOpenAlerts(businessId: string): Promise<AlertRecord[]> {
    const rows = await this.prisma.stockAlert.findMany({
      where: { businessId, resolvedAt: null, ingredient: { archivedAt: null } },
      include: { ingredient: { select: { name: true, unit: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => ({
      id: row.id,
      ingredientId: row.ingredientId,
      ingredientName: row.ingredient.name,
      unit: row.ingredient.unit,
      kind: row.kind,
      level: row.level,
      stock: row.stock.toNumber(),
      createdAt: row.createdAt,
    }));
  }

  private async assertTarget(db: PrismaClient | Tx, businessId: string, target: RecipeTarget) {
    const found =
      target.kind === 'product'
        ? await db.product.count({ where: { id: target.id, businessId } })
        : target.kind === 'product-option'
          ? await db.productOption.count({
              where: { id: target.id, optionGroup: { product: { businessId } } },
            })
          : await db.globalOption.count({ where: { id: target.id, group: { businessId } } });
    if (found !== 1) throw new RecipeTargetNotFoundError();
  }

  private async readRecipe(
    db: PrismaClient | Tx,
    target: RecipeTarget,
  ): Promise<RecipeLineRecord[]> {
    const rows = await db.recipeItem.findMany({
      where: recipeOwner(target),
      include: { ingredient: { select: { name: true, unit: true } } },
      orderBy: { ingredient: { name: 'asc' } },
    });
    return rows.map((row) => ({
      ingredientId: row.ingredientId,
      ingredientName: row.ingredient.name,
      unit: row.ingredient.unit,
      quantity: row.quantity.toNumber(),
    }));
  }
}

function recipeOwner(target: RecipeTarget) {
  if (target.kind === 'product') return { productId: target.id };
  if (target.kind === 'product-option') return { productOptionId: target.id };
  return { globalOptionId: target.id };
}

function isUniqueError(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
