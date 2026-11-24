import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PrismaOrderRepository } from '@/modules/orders/infrastructure/persistence/PrismaOrderRepository.js';
import { generateToken, hashToken } from '../../domain/deliveryTokens.js';
import { PrismaDeliveryRepository } from './PrismaDeliveryRepository.js';

// Integración con PostgreSQL real. Se activa solo con:
//   RUN_DELIVERY_DATABASE_INTEGRATION=true DELIVERY_TEST_DATABASE_URL=postgresql://…/<base de pruebas>
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

const databaseUrl = process.env.DELIVERY_TEST_DATABASE_URL;
const enabled =
  process.env.RUN_DELIVERY_DATABASE_INTEGRATION === 'true' && isDedicatedTestDatabase(databaseUrl);
const describeDatabase = enabled ? describe : describe.skip;

describeDatabase('Entregas · PostgreSQL (integración)', () => {
  let prisma: PrismaClient;
  let deliveries: PrismaDeliveryRepository;
  let orders: PrismaOrderRepository;
  const run = randomUUID().slice(0, 8);
  const ownerUserId = `delivery-it-owner-${run}`;
  const businessId = `delivery-it-business-${run}`;
  const courierPhones: string[] = [];
  let orderSequence = 0;

  function courier(index: number) {
    const phone = `66${String(Date.now() % 1e6).padStart(6, '0')}${String(index).padStart(2, '0')}`;
    courierPhones.push(phone);
    return { name: `Repartidor ${index}`, phone };
  }

  async function orderWithOffer(status: 'PREPARING' | 'READY' = 'PREPARING') {
    orderSequence += 1;
    const order = await prisma.order.create({
      data: {
        businessId,
        orderNumber: orderSequence,
        status,
        fulfillmentType: 'DELIVERY',
        paymentMethod: 'CASH',
        subtotal: 180,
        total: 180,
        customerName: 'Cliente Integración',
        customerPhone: '6691112233',
        deliveryAddress: 'Av. del Mar 100',
        deliveryNeighborhood: 'Centro',
        deliveryLatitude: 23.27,
        deliveryLongitude: -106.42,
        deliveryDistanceKm: 3.4,
        deliveryFee: 45,
        statusHistory: { create: [{ status: 'PENDING' }, { status }] },
      },
    });
    const offerToken = generateToken();
    const delivery = await deliveries.createOffer(
      {
        orderId: order.id,
        businessId,
        orderNumber: order.orderNumber,
        status,
        isHomeDelivery: true,
        paymentMethod: 'CASH',
        foodTotal: 180,
        deliveryFee: 45,
        transferConfirmedAt: null,
        delivery: null,
      },
      {
        offerTokenHash: hashToken(offerToken),
        offerExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        money: {
          foodTotal: 180,
          deliveryFee: 45,
          paymentMethod: 'CASH',
          amountCourierAdvances: 180,
          amountCourierCollects: 225,
        },
      },
    );
    return { order, delivery: delivery!, offerTokenHash: hashToken(offerToken) };
  }

  beforeAll(async () => {
    prisma = new PrismaClient({ datasourceUrl: databaseUrl });
    deliveries = new PrismaDeliveryRepository(prisma);
    orders = new PrismaOrderRepository(prisma);
    const now = new Date();
    await prisma.business.create({
      data: { id: businessId, name: 'Integración Envíos', slug: `delivery-it-${run}` },
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
  });

  beforeEach(() => {
    courierPhones.length = 0;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.business.deleteMany({ where: { id: businessId } });
    await prisma.user.deleteMany({ where: { id: ownerUserId } });
    await prisma.courier.deleteMany({
      where: { name: { startsWith: 'Repartidor ' }, deliveries: { none: {} } },
    });
    await prisma.$disconnect();
  });

  it('CARRERA: con 10 tomas simultáneas solo una gana', async () => {
    const { delivery, offerTokenHash } = await orderWithOffer();
    const attempts = Array.from({ length: 10 }, (_, index) =>
      deliveries.claim({
        offerTokenHash,
        courier: courier(index),
        courierTokenHash: hashToken(generateToken()),
        now: new Date(),
      }),
    );
    const results = await Promise.all(attempts);
    const winners = results.filter((result) => result !== null);
    expect(winners).toHaveLength(1);

    const stored = await prisma.delivery.findUniqueOrThrow({
      where: { id: delivery.id },
      include: { courier: true },
    });
    expect(stored.status).toBe('ACCEPTED');
    expect(stored.courier?.phone).toBe(winners[0]!.courier?.phone);
    expect(stored.courierTokenHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('la colonia llega a la oferta y al detalle del repartidor (la calle solo al detalle)', async () => {
    const { offerTokenHash } = await orderWithOffer();
    const offer = await deliveries.findByOfferTokenHash(offerTokenHash);
    expect(offer?.neighborhood).toBe('Centro');
    expect(JSON.stringify(offer)).not.toContain('Av. del Mar');

    const courierTokenHash = hashToken(generateToken());
    await deliveries.claim({
      offerTokenHash,
      courier: courier(3),
      courierTokenHash,
      now: new Date(),
    });
    const detail = await deliveries.findByCourierTokenHash(courierTokenHash);
    expect(detail).toMatchObject({ address: 'Av. del Mar 100', neighborhood: 'Centro' });
  });

  it('guarda la hora de la toma en UTC, sin importar la zona de la sesión', async () => {
    const { delivery, offerTokenHash } = await orderWithOffer();
    const now = new Date();
    await deliveries.claim({
      offerTokenHash,
      courier: courier(2),
      courierTokenHash: hashToken(generateToken()),
      now,
    });
    const stored = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(Math.abs(stored.acceptedAt!.getTime() - now.getTime())).toBeLessThan(1000);
  });

  it('una oferta que vence en segundos ya no se puede tomar después', async () => {
    const { delivery, offerTokenHash } = await orderWithOffer();
    const expiresAt = new Date(Date.now() + 5000);
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { offerExpiresAt: expiresAt },
    });
    await expect(
      deliveries.claim({
        offerTokenHash,
        courier: courier(3),
        courierTokenHash: hashToken(generateToken()),
        now: new Date(expiresAt.getTime() + 1),
      }),
    ).resolves.toBeNull();
  });

  it('una oferta caducada no se puede tomar', async () => {
    const { delivery, offerTokenHash } = await orderWithOffer();
    await prisma.delivery.update({
      where: { id: delivery.id },
      data: { offerExpiresAt: new Date(Date.now() - 1000) },
    });
    await expect(
      deliveries.claim({
        offerTokenHash,
        courier: courier(1),
        courierTokenHash: hashToken(generateToken()),
        now: new Date(),
      }),
    ).resolves.toBeNull();
  });

  it('entregar al repartidor mueve entrega y pedido en una transacción', async () => {
    const { order, delivery, offerTokenHash } = await orderWithOffer('READY');
    await deliveries.claim({
      offerTokenHash,
      courier: courier(1),
      courierTokenHash: hashToken(generateToken()),
      now: new Date(),
    });
    const change = await deliveries.handOff(delivery.id, new Date());
    expect(change).toMatchObject({
      orderId: order.id,
      status: 'OUT_FOR_DELIVERY',
      statusRevision: 3,
    });

    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true, statusHistory: { orderBy: { createdAt: 'asc' } } },
    });
    expect(stored.status).toBe('OUT_FOR_DELIVERY');
    expect(stored.delivery?.status).toBe('PICKED_UP');
    expect(stored.delivery?.handedOffAt).not.toBeNull();
    expect(stored.statusHistory.at(-1)?.status).toBe('OUT_FOR_DELIVERY');
    // Una segunda confirmación no cambia nada.
    await expect(deliveries.handOff(delivery.id, new Date())).resolves.toBeNull();
  });

  it('entregado cierra el pedido como entregado', async () => {
    const { order, delivery, offerTokenHash } = await orderWithOffer();
    await deliveries.claim({
      offerTokenHash,
      courier: courier(1),
      courierTokenHash: hashToken(generateToken()),
      now: new Date(),
    });
    await deliveries.handOff(delivery.id, new Date());
    await deliveries.markDelivered(delivery.id, new Date());
    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true },
    });
    expect(stored.status).toBe('DELIVERED');
    expect(stored.delivery?.status).toBe('DELIVERED');
  });

  it('cancelar el pedido cancela la entrega pendiente', async () => {
    const { order, delivery } = await orderWithOffer();
    await orders.updateStatus(ownerUserId, order.id, 'CANCELLED');
    const stored = await prisma.delivery.findUniqueOrThrow({ where: { id: delivery.id } });
    expect(stored.status).toBe('CANCELLED');
    expect(stored.cancelledAt).not.toBeNull();
  });

  it('cancelar el pedido cancela la entrega tomada (y el repartidor pierde la oferta)', async () => {
    const { order, offerTokenHash } = await orderWithOffer('READY');
    await deliveries.claim({
      offerTokenHash,
      courier: courier(1),
      courierTokenHash: hashToken(generateToken()),
      now: new Date(),
    });
    await orders.updateStatus(ownerUserId, order.id, 'CANCELLED');
    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true },
    });
    expect(stored.status).toBe('CANCELLED');
    expect(stored.delivery?.status).toBe('CANCELLED');
  });

  it('una entrega en camino NO se puede cancelar', async () => {
    const { order, delivery, offerTokenHash } = await orderWithOffer();
    await deliveries.claim({
      offerTokenHash,
      courier: courier(1),
      courierTokenHash: hashToken(generateToken()),
      now: new Date(),
    });
    await deliveries.handOff(delivery.id, new Date());
    await expect(orders.updateStatus(ownerUserId, order.id, 'CANCELLED')).rejects.toMatchObject({
      code: 'ORDER_INVALID_STATUS_TRANSITION',
    });
    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true },
    });
    expect(stored.status).toBe('OUT_FOR_DELIVERY');
    expect(stored.delivery?.status).toBe('PICKED_UP');
  });

  it('si la entrega falló, el dueño sí puede cancelar el pedido', async () => {
    const { order, delivery, offerTokenHash } = await orderWithOffer();
    await deliveries.claim({
      offerTokenHash,
      courier: courier(1),
      courierTokenHash: hashToken(generateToken()),
      now: new Date(),
    });
    await deliveries.handOff(delivery.id, new Date());
    await deliveries.markFailed(delivery.id, 'WRONG_ADDRESS', new Date());
    await orders.updateStatus(ownerUserId, order.id, 'CANCELLED');
    const stored = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { delivery: true },
    });
    expect(stored.status).toBe('CANCELLED');
    expect(stored.delivery).toMatchObject({ status: 'FAILED', failureReason: 'WRONG_ADDRESS' });
  });

  it('el pedido expone el estado de la entrega y SOLO su repartidor', async () => {
    const { order, offerTokenHash } = await orderWithOffer();
    const taker = courier(7);
    await deliveries.claim({
      offerTokenHash,
      courier: taker,
      courierTokenHash: hashToken(generateToken()),
      now: new Date(),
    });
    const json = (await orders.getById(ownerUserId, order.id))!.toJSON();
    expect(json.dispatch).toMatchObject({
      status: 'ACCEPTED',
      courier: taker,
      amountCourierAdvances: 180,
      amountCourierCollects: 225,
    });
    expect(JSON.stringify(json)).not.toContain('courierTokenHash');
    expect(JSON.stringify(json)).not.toContain('offerTokenHash');
  });
});
