import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaOrderRepository } from '@/modules/orders/infrastructure/persistence/PrismaOrderRepository.js';
import { defaultLoyaltyDesign } from '../../domain/loyaltyDesign.js';
import { PrismaLoyaltyRepository } from './PrismaLoyaltyRepository.js';

// Integración con PostgreSQL real (bloqueos, transacciones e índices únicos). Solo con:
//   RUN_LOYALTY_DATABASE_INTEGRATION=true LOYALTY_TEST_DATABASE_URL=postgresql://…/<base de pruebas>
// y únicamente contra una base local o cuyo nombre indique pruebas (nunca producción).
function isDedicatedTestDatabase(connectionString: string | undefined): boolean {
  if (!connectionString) return false;
  try {
    const url = new URL(connectionString);
    const name = url.pathname.replace(/^\//, '');
    return (
      ['localhost', '127.0.0.1'].includes(url.hostname) ||
      /(^|[-_])(test|testing|e2e|scratch)([-_]|$)/i.test(name)
    );
  } catch {
    return false;
  }
}

const databaseUrl = process.env.LOYALTY_TEST_DATABASE_URL;
const enabled =
  process.env.RUN_LOYALTY_DATABASE_INTEGRATION === 'true' && isDedicatedTestDatabase(databaseUrl);
const describeDatabase = enabled ? describe : describe.skip;

describeDatabase('Lealtad · PostgreSQL (integración)', () => {
  let prisma: PrismaClient;
  let loyalty: PrismaLoyaltyRepository;
  let orders: PrismaOrderRepository;
  const run = randomUUID().slice(0, 8);
  const ownerUserId = `loyalty-it-owner-${run}`;
  const businessId = `loyalty-it-business-${run}`;
  const otherBusinessId = `loyalty-it-other-${run}`;
  const slug = `loyalty-it-${run}`;
  let productId = '';
  let giftProductId = '';
  let phoneSequence = 0;

  const nextPhone = () => {
    phoneSequence += 1;
    return `66${String(Date.now() % 1e6).padStart(6, '0')}${String(phoneSequence).padStart(2, '0')}`;
  };

  async function setProgram(overrides: Record<string, unknown> = {}) {
    const data = {
      enabled: true,
      stampsRequired: 3,
      stampMode: 'MANUAL' as const,
      minOrderAmount: 0,
      rewardType: 'PERCENT' as const,
      rewardValue: 20,
      rewardProductId: null,
      rewardLabel: '20% de descuento',
      rewardExpiresDays: null,
      walkInDailyLimit: 5,
      design: defaultLoyaltyDesign('Integración'),
      ...overrides,
    };
    await prisma.loyaltyProgram.upsert({
      where: { businessId },
      create: { businessId, ...data },
      update: data,
    });
  }

  async function customer(name = 'Ana Integración') {
    return prisma.customer.create({ data: { businessId, name, phone: nextPhone() } });
  }

  /** Mismo cálculo de folio que el repositorio de pedidos (máximo + 1). */
  async function nextOrderNumber() {
    const last = await prisma.order.aggregate({
      where: { businessId },
      _max: { orderNumber: true },
    });
    return (last._max.orderNumber ?? 0) + 1;
  }

  async function readyOrder(customerId: string | null, total = 150) {
    return prisma.order.create({
      data: {
        businessId,
        customerId,
        orderNumber: await nextOrderNumber(),
        status: 'READY',
        fulfillmentType: 'PICKUP',
        subtotal: total,
        total,
        statusHistory: { create: [{ status: 'PENDING' }, { status: 'READY' }] },
      },
    });
  }

  /** Cliente con su tarjeta completa (un premio disponible). */
  async function customerWithReward(stampsRequired = 3) {
    const owner = await customer();
    for (let index = 0; index < stampsRequired; index += 1) {
      const order = await readyOrder(owner.id);
      await loyalty.stampOrder({
        businessId,
        orderId: order.id,
        userId: ownerUserId,
        now: new Date(),
      });
    }
    const reward = await prisma.loyaltyReward.findFirstOrThrow({
      where: { card: { customerId: owner.id }, status: 'AVAILABLE' },
    });
    const card = await prisma.loyaltyCard.findFirstOrThrow({ where: { customerId: owner.id } });
    return { owner, reward, card };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    loyalty = new PrismaLoyaltyRepository(prisma);
    orders = new PrismaOrderRepository(prisma);
    const now = new Date();
    await prisma.business.create({ data: { id: businessId, name: 'Integración Lealtad', slug } });
    await prisma.business.create({
      data: { id: otherBusinessId, name: 'Otro restaurante', slug: `${slug}-otro` },
    });
    await prisma.user.create({
      data: {
        id: ownerUserId,
        name: 'Dueño Integración',
        email: `${ownerUserId}@pedilo.test`,
        emailVerified: true,
        createdAt: now,
        updatedAt: now,
        businessId,
      },
    });
    await prisma.businessMember.create({
      data: { businessId, userId: ownerUserId, role: 'OWNER' },
    });
    const menu = await prisma.menu.create({ data: { businessId, name: 'Menú IT' } });
    const category = await prisma.category.create({
      data: { businessId, menuId: menu.id, name: 'Categoría IT' },
    });
    productId = (
      await prisma.product.create({
        data: { businessId, categoryId: category.id, name: 'Tacos IT', price: 100 },
      })
    ).id;
    giftProductId = (
      await prisma.product.create({
        data: { businessId, categoryId: category.id, name: 'Agua IT', price: 25 },
      })
    ).id;
  });

  beforeEach(async () => {
    await setProgram();
  });

  afterAll(async () => {
    if (!prisma) return;
    // Primero los pedidos: sus renglones bloquean (RESTRICT) borrar los productos.
    await prisma.order.deleteMany({ where: { businessId: { in: [businessId, otherBusinessId] } } });
    await prisma.business.deleteMany({ where: { id: { in: [businessId, otherBusinessId] } } });
    await prisma.user.deleteMany({ where: { id: ownerUserId } });
    await prisma.$disconnect();
  });

  it('CARRERA: 8 "Dar sello" simultáneos al mismo pedido dejan un solo sello', async () => {
    const owner = await customer();
    const order = await readyOrder(owner.id);
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        loyalty.stampOrder({ businessId, orderId: order.id, userId: ownerUserId, now: new Date() }),
      ),
    );
    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    const kinds = results.map((result) =>
      result.status === 'fulfilled' ? result.value.kind : null,
    );
    expect(kinds.filter((kind) => kind === 'STAMPED')).toHaveLength(1);
    expect(kinds.filter((kind) => kind === 'ALREADY_STAMPED')).toHaveLength(7);
    expect(await prisma.loyaltyStamp.count({ where: { orderId: order.id } })).toBe(1);
    const card = await prisma.loyaltyCard.findFirstOrThrow({ where: { customerId: owner.id } });
    expect(card.stampsCount).toBe(1);
  });

  it('CARRERA: sellos en el local simultáneos a un cliente sin tarjeta crean una sola tarjeta', async () => {
    const owner = await customer();
    await Promise.all(
      Array.from({ length: 4 }, () =>
        loyalty.addWalkInStamp({
          businessId,
          customerId: owner.id,
          note: null,
          userId: ownerUserId,
          now: new Date(),
        }),
      ),
    );
    const cards = await prisma.loyaltyCard.findMany({ where: { customerId: owner.id } });
    expect(cards).toHaveLength(1);
    // stampsRequired = 3: 3 sellos completan la tarjeta y el cuarto abre el ciclo nuevo.
    expect(cards[0]).toMatchObject({ stampsCount: 1, cyclesCompleted: 1 });
    expect(await prisma.loyaltyReward.count({ where: { cardId: cards[0]!.id } })).toBe(1);
  });

  it('el índice único parcial impide dos sellos vigentes para el mismo pedido', async () => {
    const owner = await customer();
    const order = await readyOrder(owner.id);
    await loyalty.stampOrder({
      businessId,
      orderId: order.id,
      userId: ownerUserId,
      now: new Date(),
    });
    const stamp = await prisma.loyaltyStamp.findFirstOrThrow({ where: { orderId: order.id } });
    await expect(
      prisma.loyaltyStamp.create({
        data: {
          cardId: stamp.cardId,
          businessId,
          orderId: order.id,
          source: 'ORDER_MANUAL',
          cycle: 0,
          position: 2,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('completar la tarjeta crea el premio con la copia del programa y reinicia el conteo', async () => {
    await setProgram({ rewardExpiresDays: 30 });
    const { card, reward } = await customerWithReward();
    expect(card).toMatchObject({ stampsCount: 0, cyclesCompleted: 1 });
    expect(reward).toMatchObject({
      rewardType: 'PERCENT',
      rewardLabel: '20% de descuento',
      cycle: 0,
    });
    expect(reward.rewardValue.toNumber()).toBe(20);
    expect(reward.expiresAt).not.toBeNull();
    // Cambiar el programa después no altera el premio ya ganado.
    await setProgram({ rewardValue: 50, rewardLabel: '50% de descuento' });
    const again = await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } });
    expect(again.rewardValue.toNumber()).toBe(20);
  });

  it('anular el sello que completó la tarjeta anula el premio y deja stampsRequired - 1', async () => {
    const { card, reward } = await customerWithReward();
    const voided = await loyalty.voidStamp({
      businessId,
      stampId: reward.sourceStampId!,
      reason: 'sello por error',
      userId: ownerUserId,
      now: new Date(),
    });
    expect(voided.voidedRewardId).toBe(reward.id);
    expect(voided.card).toMatchObject({ stampsCount: 2, cyclesCompleted: 0 });
    expect(
      (await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } })).status,
    ).toBe('VOID');
    const after = await prisma.loyaltyCard.findUniqueOrThrow({ where: { id: card.id } });
    expect(after).toMatchObject({ stampsCount: 2, cyclesCompleted: 0 });
  });

  it('CARRERA: dos canjes simultáneos del mismo premio, solo uno gana', async () => {
    const { reward } = await customerWithReward();
    const results = await Promise.allSettled([
      loyalty.redeemReward({
        businessId,
        rewardId: reward.id,
        orderId: null,
        userId: ownerUserId,
        now: new Date(),
      }),
      loyalty.redeemReward({
        businessId,
        rewardId: reward.id,
        orderId: null,
        userId: ownerUserId,
        now: new Date(),
      }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(
      (result) => result.status === 'rejected',
    ) as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: 'LOYALTY_REWARD_UNAVAILABLE' });
  });

  it('un pedido público con el premio descuenta y cancelarlo devuelve el premio', async () => {
    const { owner, reward, card } = await customerWithReward();
    const order = await orders.create(businessId, {
      customer: { name: owner.name, phone: owner.phone },
      items: [{ productId, quantity: 2 }],
      loyalty: { cardToken: card.publicToken, rewardId: reward.id, expectedDiscount: 40 },
    });
    const json = order.toJSON();
    expect(json).toMatchObject({ subtotal: 200, loyaltyDiscountAmount: 40, total: 160 });
    expect(json.loyaltyCardToken).toBeUndefined();
    expect(
      (await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } })).status,
    ).toBe('REDEEMED');

    await orders.updateStatus(ownerUserId, json.id, 'CANCELLED');
    const back = await prisma.loyaltyReward.findUniqueOrThrow({ where: { id: reward.id } });
    expect(back).toMatchObject({ status: 'AVAILABLE', redeemedOrderId: null, redeemedAt: null });
  });

  it('si el descuento cambió durante el checkout, el pedido no se crea', async () => {
    const { owner, reward, card } = await customerWithReward();
    const before = await prisma.order.count({ where: { businessId } });
    await expect(
      orders.create(businessId, {
        customer: { name: owner.name, phone: owner.phone },
        items: [{ productId, quantity: 1 }],
        loyalty: { cardToken: card.publicToken, rewardId: reward.id, expectedDiscount: 99 },
      }),
    ).rejects.toMatchObject({ code: 'LOYALTY_REWARD_CHANGED', details: { currentDiscount: 20 } });
    expect(await prisma.order.count({ where: { businessId } })).toBe(before);
  });

  it('un premio vencido no aplica', async () => {
    const { owner, reward, card } = await customerWithReward();
    await prisma.loyaltyReward.update({
      where: { id: reward.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      orders.create(businessId, {
        customer: { name: owner.name, phone: owner.phone },
        items: [{ productId, quantity: 1 }],
        loyalty: { cardToken: card.publicToken, rewardId: reward.id, expectedDiscount: 20 },
      }),
    ).rejects.toMatchObject({ code: 'LOYALTY_REWARD_UNAVAILABLE', details: { reason: 'EXPIRED' } });
  });

  it('producto gratis lo agrega a precio completo y lo descuenta completo', async () => {
    await setProgram({
      rewardType: 'FREE_PRODUCT',
      rewardValue: 0,
      rewardProductId: giftProductId,
      rewardLabel: 'Agua gratis',
    });
    const { owner, reward, card } = await customerWithReward();
    const order = (
      await orders.create(businessId, {
        customer: { name: owner.name, phone: owner.phone },
        items: [{ productId, quantity: 1 }],
        loyalty: { cardToken: card.publicToken, rewardId: reward.id, expectedDiscount: 25 },
      })
    ).toJSON();
    expect(order).toMatchObject({ subtotal: 125, loyaltyDiscountAmount: 25, total: 100 });
    const gift = order.items.find((item) => item.productId === giftProductId);
    expect(gift?.options.map((option) => option.name)).toContain('Premio de lealtad');
  });

  it('un cliente nuevo recibe la llave de su tarjeta; uno existente no', async () => {
    const phone = nextPhone();
    const first = (
      await orders.create(businessId, {
        customer: { name: 'Nuevo', phone },
        items: [{ productId, quantity: 1 }],
      })
    ).toJSON();
    expect(first.loyaltyCardToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const second = (
      await orders.create(businessId, {
        customer: { name: 'Nuevo', phone },
        items: [{ productId, quantity: 1 }],
      })
    ).toJSON();
    expect(second.loyaltyCardToken).toBeUndefined();
  });

  it('el token de otro restaurante no sirve para canjear', async () => {
    const { owner, reward } = await customerWithReward();
    const otherCustomer = await prisma.customer.create({
      data: { businessId: otherBusinessId, name: 'X', phone: nextPhone() },
    });
    const otherCard = await prisma.loyaltyCard.create({
      data: {
        businessId: otherBusinessId,
        customerId: otherCustomer.id,
        publicToken: 'x'.repeat(43),
      },
    });
    await expect(
      orders.create(businessId, {
        customer: { name: owner.name, phone: owner.phone },
        items: [{ productId, quantity: 1 }],
        loyalty: { cardToken: otherCard.publicToken, rewardId: reward.id, expectedDiscount: 20 },
      }),
    ).rejects.toMatchObject({
      code: 'LOYALTY_REWARD_UNAVAILABLE',
      details: { reason: 'NOT_FOUND' },
    });
  });

  it('modo automático: sella dentro de la transacción que marca el pedido como listo', async () => {
    await setProgram({ stampMode: 'AUTO' });
    const owner = await customer('Beto Auto');
    const order = await prisma.order.create({
      data: {
        businessId,
        customerId: owner.id,
        orderNumber: await nextOrderNumber(),
        status: 'PREPARING',
        fulfillmentType: 'PICKUP',
        subtotal: 100,
        total: 100,
        statusHistory: { create: [{ status: 'PENDING' }, { status: 'PREPARING' }] },
      },
    });
    const update = await orders.updateStatus(ownerUserId, order.id, 'READY');
    expect(update?.loyalty).toMatchObject({
      mode: 'AUTO',
      stamped: { customerFirstName: 'Beto', stampsCount: 1, stampsRequired: 3, completed: false },
    });
    expect(
      await prisma.loyaltyStamp.count({ where: { orderId: order.id, source: 'ORDER_AUTO' } }),
    ).toBe(1);
  });

  it('modo automático: si el sello falla, el pedido igual pasa a listo (savepoint)', async () => {
    await setProgram({ stampMode: 'AUTO' });
    // Cliente de OTRO restaurante: el sellado falla al buscar al cliente en este negocio.
    const foreign = await prisma.customer.create({
      data: { businessId: otherBusinessId, name: 'Ajeno', phone: nextPhone() },
    });
    const order = await prisma.order.create({
      data: {
        businessId,
        customerId: foreign.id,
        orderNumber: await nextOrderNumber(),
        status: 'PREPARING',
        fulfillmentType: 'PICKUP',
        subtotal: 100,
        total: 100,
        statusHistory: { create: [{ status: 'PENDING' }, { status: 'PREPARING' }] },
      },
    });
    const update = await orders.updateStatus(ownerUserId, order.id, 'READY');
    expect(update?.status).toBe('READY');
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe(
      'READY',
    );
    expect(await prisma.loyaltyStamp.count({ where: { orderId: order.id } })).toBe(0);
  });

  it('tope diario de sellos en el local', async () => {
    await setProgram({ walkInDailyLimit: 2, stampsRequired: 10 });
    const owner = await customer();
    const stamp = () =>
      loyalty.addWalkInStamp({
        businessId,
        customerId: owner.id,
        note: 'compra en caja',
        userId: ownerUserId,
        now: new Date(),
      });
    await stamp();
    await stamp();
    await expect(stamp()).rejects.toMatchObject({ code: 'LOYALTY_WALK_IN_LIMIT' });
  });
});
