/**
 * End-to-end inventory flow against a real PostgreSQL database.
 *
 * Requires a database with every migration applied:
 *   INVENTORY_INTEGRATION_DATABASE_URL=postgresql://... npx vitest run inventory.integration
 * Skipped when the variable is not set. Seeds its own uniquely named data.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@prisma/client';
import { PrismaOrderRepository } from '@/modules/orders/infrastructure/persistence/PrismaOrderRepository.js';
import { orderEventHub } from '@/modules/orders/infrastructure/sse/OrderEventHub.js';
import { InventoryService } from './application/services/InventoryService.js';
import { PrismaInventoryRepository } from './infrastructure/persistence/PrismaInventoryRepository.js';
import { publishStockAlerts } from './infrastructure/stockAlertPublisher.js';

const url = process.env.INVENTORY_INTEGRATION_DATABASE_URL;

describe.skipIf(!url)('inventory (PostgreSQL)', () => {
  const prisma = new PrismaClient({ datasources: { db: { url: url ?? '' } } });
  const orders = new PrismaOrderRepository(prisma);
  const inventory = new InventoryService(new PrismaInventoryRepository(prisma), {
    publish: publishStockAlerts,
  });
  const suffix = Date.now().toString(36);
  const ids = {} as Record<string, string>;
  const published: { kind: string; level: string; ingredientName: string }[] = [];

  const stockOf = async (id: string) =>
    (await prisma.ingredient.findUniqueOrThrow({ where: { id } })).stock.toNumber();
  const burger = (quantity: number, optionIds: string[] = []) => ({
    customer: { name: 'Ana', phone: null },
    items: [{ productId: ids.burger!, quantity, optionIds }],
  });

  beforeAll(async () => {
    vi.spyOn(orderEventHub, 'publishStockAlert').mockImplementation((event) => {
      published.push({
        kind: event.kind,
        level: event.level,
        ingredientName: event.ingredientName,
      });
      return 1;
    });
    const business = await prisma.business.create({
      data: { name: `Negocio ${suffix}`, slug: `negocio-${suffix}` },
    });
    ids.business = business.id;
    const user = await prisma.user.create({
      data: {
        id: `user-${suffix}`,
        name: 'Owner',
        email: `owner-${suffix}@example.com`,
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        businessId: business.id,
      },
    });
    ids.user = user.id;
    const menu = await prisma.menu.create({ data: { businessId: business.id, name: 'Menú' } });
    const category = await prisma.category.create({
      data: { businessId: business.id, menuId: menu.id, name: 'Burgers' },
    });
    const product = await prisma.product.create({
      data: {
        businessId: business.id,
        categoryId: category.id,
        name: 'Burger',
        price: 100,
        optionGroups: {
          create: {
            name: 'Extras',
            options: { create: { name: 'Extra queso', price: 10 } },
          },
        },
      },
      include: { optionGroups: { include: { options: true } } },
    });
    ids.burger = product.id;
    ids.cheeseOption = product.optionGroups[0]!.options[0]!.id;
    const globalGroup = await prisma.globalOptionGroup.create({
      data: {
        businessId: business.id,
        name: 'Toppings',
        options: { create: { name: 'Tocino', price: 15 } },
        products: { create: { productId: product.id } },
      },
      include: { options: true },
    });
    ids.baconOption = globalGroup.options[0]!.id;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    if (ids.business) {
      // Order items restrict product deletion, so remove the orders first.
      await prisma.order.deleteMany({ where: { businessId: ids.business } });
      await prisma.business.delete({ where: { id: ids.business } });
    }
    if (ids.user) await prisma.user.deleteMany({ where: { id: ids.user } });
    await prisma.$disconnect();
  });

  it('creates ingredients, registers purchases and defines recipes for products and options', async () => {
    const make = async (name: string, unit: 'G' | 'UNIT', stock: number) =>
      (
        await inventory.createIngredient(ids.user!, ids.business!, {
          name,
          unit,
          initialStock: stock,
        })
      ).id;
    ids.meat = await make('Carne', 'G', 1000);
    ids.cheese = await make('Queso', 'G', 100);
    ids.bacon = await make('Tocino', 'G', 100);
    ids.bun = await make('Pan', 'UNIT', 50);
    expect((await inventory.listIngredients(ids.user!, ids.business!, {})).counts.OK).toBe(4);

    const target = (kind: 'product' | 'product-option' | 'global-option', id: string) => ({
      kind,
      id,
    });
    await inventory.setRecipe(ids.user!, ids.business!, target('product', ids.burger!), [
      { ingredientId: ids.meat!, quantity: 150 },
      { ingredientId: ids.bun!, quantity: 1 },
    ]);
    await inventory.setRecipe(
      ids.user!,
      ids.business!,
      target('product-option', ids.cheeseOption!),
      [{ ingredientId: ids.cheese!, quantity: 30 }],
    );
    const bacon = await inventory.setRecipe(
      ids.user!,
      ids.business!,
      target('global-option', ids.baconOption!),
      [{ ingredientId: ids.bacon!, quantity: 20 }],
    );
    expect(bacon).toEqual([
      { ingredientId: ids.bacon, ingredientName: 'Tocino', unit: 'G', quantity: 20 },
    ]);
  });

  it('keeps stock untouched until the order is READY, then deducts product and option recipes', async () => {
    const order = await orders.createForRestaurant(
      ids.user!,
      ids.business!,
      burger(2, [ids.cheeseOption!, ids.baconOption!]),
    );
    const orderId = order.toJSON().id;
    const saved = await prisma.orderItemOption.findMany({ where: { orderItem: { orderId } } });
    expect(saved.map((o) => [o.productOptionId, o.globalOptionId])).toEqual(
      expect.arrayContaining([
        [ids.cheeseOption, null],
        [null, ids.baconOption],
      ]),
    );

    await orders.updateStatus(ids.user!, orderId, 'PREPARING');
    expect(await stockOf(ids.meat!)).toBe(1000);

    await orders.updateStatus(ids.user!, orderId, 'READY');
    expect(await stockOf(ids.meat!)).toBe(700); // 2 x 150
    expect(await stockOf(ids.bun!)).toBe(48); // 2 x 1
    expect(await stockOf(ids.cheese!)).toBe(40); // 2 x 30
    expect(await stockOf(ids.bacon!)).toBe(60); // 2 x 20

    const movements = await prisma.stockMovement.findMany({ where: { orderId } });
    expect(movements).toHaveLength(4);
    expect(movements.every((m) => m.type === 'CONSUMPTION' && m.quantity.toNumber() < 0)).toBe(
      true,
    );
    expect(movements.find((m) => m.ingredientId === ids.meat)?.stockAfter.toNumber()).toBe(700);
  });

  it('opens consumption alerts (>= 20% used in the window) and publishes them live', async () => {
    const alerts = await inventory.listAlerts(ids.user!, ids.business!);
    // Carne 30%, Queso 60%, Tocino 40% used; Pan only 4%.
    expect(
      alerts
        .filter((a) => a.kind === 'CONSUMPTION')
        .map((a) => a.ingredientName)
        .sort(),
    ).toEqual(['Carne', 'Queso', 'Tocino']);
    expect(published.filter((p) => p.kind === 'CONSUMPTION')).toHaveLength(3);
    expect(published.some((p) => p.kind === 'STOCK')).toBe(false);
  });

  it('cancelling an order never deducts stock', async () => {
    const order = await orders.createForRestaurant(ids.user!, ids.business!, burger(1));
    await orders.updateStatus(ids.user!, order.toJSON().id, 'CANCELLED');
    expect(await stockOf(ids.meat!)).toBe(700);
  });

  it('opens a stock alert on crossing the threshold, escalates it, and resolves it when restocked', async () => {
    published.length = 0;
    // Queso: par 100, default 20% -> threshold 20. 40 -> 15 is LOW? 15 <= 20 but > 10.
    await inventory.recordMovement(ids.user!, ids.business!, ids.cheese!, {
      type: 'WASTE',
      quantity: 25,
    });
    expect(published).toContainEqual({ kind: 'STOCK', level: 'LOW', ingredientName: 'Queso' });
    // 15 -> 5 is CRITICAL (<= 10): escalation notifies again.
    await inventory.recordMovement(ids.user!, ids.business!, ids.cheese!, {
      type: 'WASTE',
      quantity: 10,
    });
    expect(published).toContainEqual({ kind: 'STOCK', level: 'CRITICAL', ingredientName: 'Queso' });
    // Staying CRITICAL does not notify again.
    published.length = 0;
    await inventory.recordMovement(ids.user!, ids.business!, ids.cheese!, {
      type: 'WASTE',
      quantity: 1,
    });
    expect(published.filter((p) => p.kind === 'STOCK')).toHaveLength(0);

    const open = await inventory.listAlerts(ids.user!, ids.business!);
    expect(open.filter((a) => a.kind === 'STOCK')).toHaveLength(1);

    await inventory.recordMovement(ids.user!, ids.business!, ids.cheese!, {
      type: 'PURCHASE',
      quantity: 500,
    });
    const after = await inventory.listAlerts(ids.user!, ids.business!);
    expect(after.filter((a) => a.kind === 'STOCK' && a.ingredientName === 'Queso')).toHaveLength(0);
  });

  it('counts stock with an adjustment, computing the delta from the real stock', async () => {
    const { ingredient, movement } = await inventory.recordMovement(
      ids.user!,
      ids.business!,
      ids.bun!,
      { type: 'ADJUSTMENT', quantity: 40, note: 'Conteo' },
    );
    expect(ingredient.stock).toBe(40);
    expect(movement.quantity).toBe(-8);
  });

  it('blocks customer orders when configured, but never staff orders', async () => {
    // Queso is now 500 + 4 = 504 (par bumped to 504). Drain it to make it insufficient.
    await inventory.recordMovement(ids.user!, ids.business!, ids.cheese!, {
      type: 'ADJUSTMENT',
      quantity: 40,
    });
    await inventory.updateSettings(ids.user!, ids.business!, { blockMode: 'OUT_OF_STOCK' });

    // 40g of cheese covers one burger with extra cheese (30g) but not two (60g).
    await expect(
      orders.create(ids.business!, burger(2, [ids.cheeseOption!])),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      message: expect.stringContaining('Queso'),
    });
    await expect(
      orders.create(ids.business!, burger(1, [ids.cheeseOption!])),
    ).resolves.toBeDefined();
    // Staff orders are never blocked.
    await expect(
      orders.createForRestaurant(ids.user!, ids.business!, burger(5, [ids.cheeseOption!])),
    ).resolves.toBeDefined();

    // LOW_STOCK also blocks while enough stock exists, as long as the ingredient is low.
    await inventory.updateSettings(ids.user!, ids.business!, { blockMode: 'LOW_STOCK' });
    await inventory.updateIngredient(ids.user!, ids.business!, ids.cheese!, {
      lowStockMode: 'ABSOLUTE',
      lowStockValue: 50,
    });
    await expect(
      orders.create(ids.business!, burger(1, [ids.cheeseOption!])),
    ).rejects.toMatchObject({
      code: 'INSUFFICIENT_STOCK',
    });
    // Orders that do not touch the low ingredient are fine.
    await expect(orders.create(ids.business!, burger(1))).resolves.toBeDefined();

    await inventory.updateSettings(ids.user!, ids.business!, { blockMode: 'NONE' });
    await expect(
      orders.create(ids.business!, burger(1, [ids.cheeseOption!])),
    ).resolves.toBeDefined();
  });

  it("rejects another business's user and archived ingredients in recipes", async () => {
    await expect(
      inventory.listIngredients('someone-else', ids.business!, {}),
    ).rejects.toMatchObject({
      code: 'INVENTORY_BUSINESS_ACCESS_DENIED',
    });
    await inventory.archiveIngredient(ids.user!, ids.business!, ids.bacon!);
    await expect(
      inventory.setRecipe(ids.user!, ids.business!, { kind: 'product', id: ids.burger! }, [
        { ingredientId: ids.bacon!, quantity: 1 },
      ]),
    ).rejects.toMatchObject({ code: 'RECIPE_INGREDIENT_INVALID' });
  });
});
