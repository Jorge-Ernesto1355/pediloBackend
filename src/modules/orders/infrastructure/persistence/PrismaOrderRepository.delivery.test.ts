import { Prisma, PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaOrderRepository } from './PrismaOrderRepository.js';
import { orderEventHub } from '@/modules/orders/infrastructure/sse/OrderEventHub.js';
import type { CreateOrderDTO } from '../../application/dto/OrderDTO.js';

// Inventory has its own tests; here the stock ledger must not touch the mocked transaction.
vi.mock('@/modules/inventory/infrastructure/persistence/stockLedger.js', () => ({
  assertStockAvailable: vi.fn().mockResolvedValue(undefined),
  consumeStockForOrder: vi.fn().mockResolvedValue([]),
}));

// Valores solo de prueba: Pedilo no trae tarifas precargadas.
const origin = { latitude: 23.2494, longitude: -106.4111 };
const EARTH_RADIUS_KM = 6371.0088;

/** Punto al norte del origen con distancia de envío (× 1.3) igual a `roadKm`. */
function pointAtRoadKm(roadKm: number) {
  return {
    latitude: origin.latitude + ((roadKm / 1.3 / EARTH_RADIUS_KM) * 180) / Math.PI,
    longitude: origin.longitude,
  };
}

function deliveryRow(enabled = true) {
  return {
    ubicationMaps: {
      latitude: new Prisma.Decimal(origin.latitude),
      longitude: new Prisma.Decimal(origin.longitude),
    },
    settings: {
      deliveryEnabled: enabled,
      maxDeliveryKm: new Prisma.Decimal(5),
      deliveryFeeConfig: {
        type: 'DISTANCE_TIERS',
        tiers: [
          { upToKm: 2, fee: 30 },
          { upToKm: 5, fee: 50 },
        ],
      },
    },
  };
}

function setup({ enabled = true } = {}) {
  const now = new Date('2026-11-22T18:00:00.000Z');
  const tx = {
    business: {
      findUnique: vi.fn(async (args: { select?: { settings?: unknown } }) =>
        args.select?.settings ? deliveryRow(enabled) : { id: 'business-1' },
      ),
    },
    product: {
      findMany: vi.fn().mockResolvedValue([
        {
          id: 'product-1',
          businessId: 'business-1',
          name: 'Tacos',
          price: new Prisma.Decimal(100),
          isAvailable: true,
          optionGroups: [],
          comboIncludes: [],
        },
      ]),
    },
    order: {
      aggregate: vi.fn().mockResolvedValue({ _max: { orderNumber: 0 } }),
      create: vi.fn().mockResolvedValue({ id: 'order-1', createdAt: now }),
    },
    customer: { upsert: vi.fn() },
  };
  const loadedRow = {
    id: 'order-1',
    businessId: 'business-1',
    customerId: null,
    orderNumber: 1,
    status: 'PENDING' as const,
    source: 'PUBLIC' as const,
    fulfillmentType: 'DELIVERY' as const,
    paymentMethod: 'CASH' as const,
    subtotal: new Prisma.Decimal(100),
    discountAmount: new Prisma.Decimal(0),
    total: new Prisma.Decimal(100),
    version: 1,
    customerName: 'Ana',
    customerPhone: null,
    notes: null,
    deliveryAddress: 'Av. del Mar 100',
    deliveryNeighborhood: 'Centro',
    deliveryReference: 'Portón azul',
    deliveryLatitude: new Prisma.Decimal(origin.latitude),
    deliveryLongitude: new Prisma.Decimal(origin.longitude),
    deliveryDistanceKm: new Prisma.Decimal(0),
    deliveryFee: new Prisma.Decimal(30),
    transferConfirmedAt: null,
    createdAt: now,
    updatedAt: now,
    items: [],
    statusHistory: [],
  };
  const prisma = {
    $transaction: vi.fn(async (callback: (transaction: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
    order: { findUnique: vi.fn().mockResolvedValue(loadedRow) },
  } as unknown as PrismaClient;
  vi.spyOn(orderEventHub, 'publishNewOrder').mockImplementation(() => 0);
  return { tx, repository: new PrismaOrderRepository(prisma) };
}

function deliveryOrder(overrides: Partial<CreateOrderDTO> = {}): CreateOrderDTO {
  return {
    customer: { name: 'Ana', phone: null },
    items: [{ productId: 'product-1', quantity: 1 }],
    fulfillmentType: 'DELIVERY',
    delivery: {
      address: 'Av. del Mar 100',
      neighborhood: 'Centro',
      reference: 'Portón azul',
      ...pointAtRoadKm(3.4),
    },
    expectedDeliveryFee: 50,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PrismaOrderRepository · pedidos a domicilio', () => {
  it('guarda el snapshot con distancia y envío calculados en el servidor', async () => {
    const { tx, repository } = setup();
    await repository.create('business-1', deliveryOrder());
    const data = tx.order.create.mock.calls[0]![0].data;
    expect(data).toMatchObject({
      fulfillmentType: 'DELIVERY',
      deliveryAddress: 'Av. del Mar 100',
      deliveryNeighborhood: 'Centro',
      deliveryReference: 'Portón azul',
      deliveryDistanceKm: 3.4,
      deliveryFee: 50,
      // total sigue siendo solo la comida, sin envío
      total: 100,
    });
    expect(data.deliveryLatitude).toBeCloseTo(pointAtRoadKm(3.4).latitude, 10);
  });

  it('expone el envío y la entrega en el pedido creado', async () => {
    const { repository } = setup();
    const order = (await repository.create('business-1', deliveryOrder())).toJSON();
    expect(order.deliveryFee).toBe(30);
    expect(order.delivery).toEqual({
      address: 'Av. del Mar 100',
      neighborhood: 'Centro',
      reference: 'Portón azul',
      latitude: origin.latitude,
      longitude: origin.longitude,
      distanceKm: 0,
    });
  });

  it('si el envío cambió no crea el pedido y devuelve el envío nuevo', async () => {
    const { tx, repository } = setup();
    const attempt = repository.create('business-1', deliveryOrder({ expectedDeliveryFee: 30 }));
    await expect(attempt).rejects.toMatchObject({
      code: 'DELIVERY_FEE_CHANGED',
      statusCode: 409,
      details: { expectedDeliveryFee: 30, currentDeliveryFee: 50, distanceKm: 3.4 },
    });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('fuera del radio no crea el pedido', async () => {
    const { tx, repository } = setup();
    const attempt = repository.create(
      'business-1',
      deliveryOrder({
        delivery: { address: 'Lejos 1', neighborhood: 'Lejana', ...pointAtRoadKm(5.1) },
      }),
    );
    await expect(attempt).rejects.toMatchObject({ code: 'DELIVERY_OUT_OF_RANGE', statusCode: 422 });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('con el envío desactivado no crea el pedido', async () => {
    const { tx, repository } = setup({ enabled: false });
    await expect(repository.create('business-1', deliveryOrder())).rejects.toMatchObject({
      code: 'DELIVERY_UNAVAILABLE',
    });
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('el pedido manual del restaurante no acepta domicilio', async () => {
    const { tx, repository } = setup();
    await expect(
      repository.createForRestaurant('owner-1', 'business-1', deliveryOrder()),
    ).rejects.toThrow();
    expect(tx.order.create).not.toHaveBeenCalled();
  });

  it('un pedido para recoger no guarda datos de entrega', async () => {
    const { tx, repository } = setup();
    await repository.create('business-1', {
      customer: { name: 'Ana', phone: null },
      items: [{ productId: 'product-1', quantity: 1 }],
      fulfillmentType: 'PICKUP',
    });
    const data = tx.order.create.mock.calls[0]![0].data;
    expect(data).not.toHaveProperty('deliveryAddress');
    expect(data).not.toHaveProperty('deliveryFee');
  });
});
