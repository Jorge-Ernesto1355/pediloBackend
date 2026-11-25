import type { Prisma } from '@prisma/client';
import {
  aggregateRequirements,
  computeStockLevel,
  isHighConsumption,
  isWorseLevel,
  lowStockThreshold,
  roundQuantity,
  type OrderedLine,
  type RecipeBook,
  type RecipeLine,
  type StockAlertNotice,
  type StockBlockMode,
  type StockLevel,
} from '../../domain/stock.js';
import { InsufficientStockError } from '../../domain/errors.js';

/**
 * Stock operations that must run inside the caller's Prisma transaction so a
 * stock change and the order/movement that caused it commit (or fail) together.
 */
export type Tx = Prisma.TransactionClient;

export type InventorySettingsValues = {
  alertsEnabled: boolean;
  defaultLowStockPercent: number;
  consumptionAlertPercent: number;
  consumptionWindowHours: number;
  blockMode: StockBlockMode;
};

export const DEFAULT_INVENTORY_SETTINGS: InventorySettingsValues = {
  alertsEnabled: true,
  defaultLowStockPercent: 20,
  consumptionAlertPercent: 20,
  consumptionWindowHours: 24,
  blockMode: 'NONE',
};

export async function loadInventorySettings(
  tx: Tx,
  businessId: string,
): Promise<InventorySettingsValues> {
  const row = await tx.inventorySettings.findUnique({ where: { businessId } });
  if (!row) return DEFAULT_INVENTORY_SETTINGS;
  return {
    alertsEnabled: row.alertsEnabled,
    defaultLowStockPercent: row.defaultLowStockPercent.toNumber(),
    consumptionAlertPercent: row.consumptionAlertPercent.toNumber(),
    consumptionWindowHours: row.consumptionWindowHours,
    blockMode: row.blockMode,
  };
}

type IngredientForLevel = {
  stock: Prisma.Decimal;
  parLevel: Prisma.Decimal;
  lowStockMode: 'PERCENT' | 'ABSOLUTE';
  lowStockValue: Prisma.Decimal | null;
};

export function thresholdFor(ingredient: IngredientForLevel, settings: InventorySettingsValues) {
  return lowStockThreshold({
    parLevel: ingredient.parLevel.toNumber(),
    mode: ingredient.lowStockMode,
    value: ingredient.lowStockValue?.toNumber() ?? null,
    defaultPercent: settings.defaultLowStockPercent,
  });
}

export function levelFor(
  ingredient: IngredientForLevel,
  settings: InventorySettingsValues,
): StockLevel {
  return computeStockLevel(ingredient.stock.toNumber(), thresholdFor(ingredient, settings));
}

export async function loadRecipeBook(
  tx: Tx,
  businessId: string,
  lines: OrderedLine[],
): Promise<RecipeBook> {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const productOptionIds = new Set<string>();
  const globalOptionIds = new Set<string>();
  for (const line of lines)
    for (const option of line.options) {
      if (option.productOptionId) productOptionIds.add(option.productOptionId);
      if (option.globalOptionId) globalOptionIds.add(option.globalOptionId);
    }
  const book: RecipeBook = {
    byProduct: new Map(),
    byProductOption: new Map(),
    byGlobalOption: new Map(),
  };
  const rows = await tx.recipeItem.findMany({
    where: {
      businessId,
      OR: [
        { productId: { in: productIds } },
        { productOptionId: { in: [...productOptionIds] } },
        { globalOptionId: { in: [...globalOptionIds] } },
      ],
    },
    select: {
      ingredientId: true,
      quantity: true,
      productId: true,
      productOptionId: true,
      globalOptionId: true,
    },
  });
  const push = (map: Map<string, RecipeLine[]>, key: string | null, line: RecipeLine) => {
    if (!key) return;
    map.set(key, [...(map.get(key) ?? []), line]);
  };
  for (const row of rows) {
    const line = { ingredientId: row.ingredientId, quantity: row.quantity.toNumber() };
    push(book.byProduct, row.productId, line);
    push(book.byProductOption, row.productOptionId, line);
    push(book.byGlobalOption, row.globalOptionId, line);
  }
  return book;
}

/**
 * Applies a signed change to an ingredient and records it in the ledger. The
 * increment/decrement is atomic in SQL, so concurrent orders cannot lose updates.
 */
export async function applyStockChange(
  tx: Tx,
  input: {
    businessId: string;
    ingredientId: string;
    type: 'PURCHASE' | 'CONSUMPTION' | 'WASTE' | 'ADJUSTMENT';
    delta: number;
    orderId?: string;
    userId?: string;
    note?: string | null;
  },
) {
  const delta = roundQuantity(input.delta);
  const updated = await tx.ingredient.update({
    where: { id: input.ingredientId },
    data: { stock: { increment: delta } },
  });
  const movement = await tx.stockMovement.create({
    data: {
      businessId: input.businessId,
      ingredientId: input.ingredientId,
      type: input.type,
      quantity: delta,
      stockAfter: updated.stock,
      orderId: input.orderId,
      userId: input.userId,
      note: input.note ?? null,
    },
  });
  return { ingredient: updated, movement };
}

/**
 * Re-evaluates the open alerts of the given ingredients: opens an alert when a
 * condition starts, escalates it when it gets worse and resolves it once it
 * clears. Only newly opened or escalated alerts are returned for live delivery,
 * so a persistently low ingredient does not notify on every order.
 */
export async function evaluateStockAlerts(
  tx: Tx,
  businessId: string,
  ingredientIds: string[],
  settings: InventorySettingsValues,
  now = new Date(),
): Promise<StockAlertNotice[]> {
  const ids = [...new Set(ingredientIds)];
  if (ids.length === 0 || !settings.alertsEnabled) return [];

  const [ingredients, openAlerts, consumedRows] = await Promise.all([
    tx.ingredient.findMany({ where: { id: { in: ids }, businessId, archivedAt: null } }),
    tx.stockAlert.findMany({ where: { ingredientId: { in: ids }, resolvedAt: null } }),
    tx.stockMovement.groupBy({
      by: ['ingredientId'],
      where: {
        ingredientId: { in: ids },
        type: 'CONSUMPTION',
        createdAt: { gte: new Date(now.getTime() - settings.consumptionWindowHours * 3_600_000) },
      },
      _sum: { quantity: true },
    }),
  ]);
  const consumedById = new Map(
    consumedRows.map((row) => [row.ingredientId, -(row._sum.quantity?.toNumber() ?? 0)]),
  );
  const notices: StockAlertNotice[] = [];

  for (const ingredient of ingredients) {
    const stock = ingredient.stock.toNumber();
    const threshold = thresholdFor(ingredient, settings);
    const base = {
      businessId,
      ingredientId: ingredient.id,
      ingredientName: ingredient.name,
      unit: ingredient.unit,
      stock,
      threshold,
    };

    const level = computeStockLevel(stock, threshold);
    const openStock = openAlerts.find(
      (alert) => alert.ingredientId === ingredient.id && alert.kind === 'STOCK',
    );
    if (level === 'OK') {
      if (openStock)
        await tx.stockAlert.update({ where: { id: openStock.id }, data: { resolvedAt: now } });
    } else if (!openStock) {
      const created = await tx.stockAlert.create({
        data: { businessId, ingredientId: ingredient.id, kind: 'STOCK', level, stock },
      });
      notices.push({
        ...base,
        alertId: created.id,
        kind: 'STOCK',
        level,
        createdAt: created.createdAt,
      });
    } else if (openStock.level !== level) {
      const worse = isWorseLevel(level, openStock.level as StockLevel);
      await tx.stockAlert.update({ where: { id: openStock.id }, data: { level, stock } });
      if (worse)
        notices.push({ ...base, alertId: openStock.id, kind: 'STOCK', level, createdAt: now });
    }

    const percent =
      ingredient.consumptionAlertPercent?.toNumber() ?? settings.consumptionAlertPercent;
    const high = isHighConsumption(consumedById.get(ingredient.id) ?? 0, stock, percent);
    const openConsumption = openAlerts.find(
      (alert) => alert.ingredientId === ingredient.id && alert.kind === 'CONSUMPTION',
    );
    if (high && !openConsumption) {
      const created = await tx.stockAlert.create({
        data: {
          businessId,
          ingredientId: ingredient.id,
          kind: 'CONSUMPTION',
          level: 'HIGH',
          stock,
        },
      });
      notices.push({
        ...base,
        alertId: created.id,
        kind: 'CONSUMPTION',
        level: 'HIGH',
        createdAt: created.createdAt,
      });
    } else if (!high && openConsumption) {
      await tx.stockAlert.update({
        where: { id: openConsumption.id },
        data: { resolvedAt: now },
      });
    }
  }
  return notices;
}

async function orderedLinesOf(tx: Tx, orderId: string) {
  const order = await tx.order.findUnique({
    where: { id: orderId },
    select: {
      businessId: true,
      items: {
        select: {
          productId: true,
          quantity: true,
          options: { select: { productOptionId: true, globalOptionId: true } },
        },
      },
    },
  });
  if (!order) return null;
  return { businessId: order.businessId, lines: order.items as OrderedLine[] };
}

/**
 * Deducts an order's ingredients. Called inside the transaction that marks the
 * order READY. READY is terminal and the ledger is unique per
 * (order, ingredient, type), so an order can never be deducted twice.
 */
export async function consumeStockForOrder(tx: Tx, orderId: string): Promise<StockAlertNotice[]> {
  const order = await orderedLinesOf(tx, orderId);
  if (!order) return [];
  const requirements = aggregateRequirements(
    order.lines,
    await loadRecipeBook(tx, order.businessId, order.lines),
  );
  if (requirements.size === 0) return [];

  // Fixed order so concurrent orders lock ingredient rows consistently.
  const ingredientIds = [...requirements.keys()].sort();
  for (const ingredientId of ingredientIds)
    await applyStockChange(tx, {
      businessId: order.businessId,
      ingredientId,
      type: 'CONSUMPTION',
      delta: -(requirements.get(ingredientId) ?? 0),
      orderId,
    });
  return evaluateStockAlerts(
    tx,
    order.businessId,
    ingredientIds,
    await loadInventorySettings(tx, order.businessId),
  );
}

/**
 * For customer orders: refuses the order when the business chose to block and
 * an ingredient it needs is out of (or, in LOW_STOCK mode, running low on) stock.
 * Pending orders do not reserve stock; ingredients are only deducted at READY.
 */
export async function assertStockAvailable(
  tx: Tx,
  businessId: string,
  lines: OrderedLine[],
): Promise<void> {
  const settings = await loadInventorySettings(tx, businessId);
  if (settings.blockMode === 'NONE') return;
  const requirements = aggregateRequirements(lines, await loadRecipeBook(tx, businessId, lines));
  if (requirements.size === 0) return;

  const ingredients = await tx.ingredient.findMany({
    where: { id: { in: [...requirements.keys()] }, businessId, archivedAt: null },
  });
  const blocked = ingredients.filter((ingredient) => {
    const needed = requirements.get(ingredient.id) ?? 0;
    if (ingredient.stock.toNumber() - needed < 0) return true;
    return settings.blockMode === 'LOW_STOCK' && levelFor(ingredient, settings) !== 'OK';
  });
  if (blocked.length > 0) throw new InsufficientStockError(blocked.map((item) => item.name));
}
