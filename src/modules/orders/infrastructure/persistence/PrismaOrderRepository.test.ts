import { Prisma, PrismaClient } from '@prisma/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { phoneSchema } from '@/shared/validation/phone.js';
import { PrismaOrderRepository } from './PrismaOrderRepository.js';

function orderRow() {
  const date = new Date();
  return {
    id: 'order-1',
    businessId: 'business-1',
    customerId: 'customer-1',
    orderNumber: 1,
    status: 'PENDING' as const,
    source: 'PUBLIC' as const,
    subtotal: new Prisma.Decimal(100),
    total: new Prisma.Decimal(100),
    customerName: 'Nombre del pedido',
    customerPhone: '6691234567',
    notes: null,
    createdAt: date,
    updatedAt: date,
    items: [
      {
        id: 'item-1',
        productId: 'product-1',
        productName: 'Producto',
        unitPrice: new Prisma.Decimal(100),
        quantity: 1,
        subtotal: new Prisma.Decimal(100),
        options: [],
      },
    ],
    statusHistory: [{ status: 'PENDING' as const, createdAt: date }],
  };
}

describe('PrismaOrderRepository customer identity', () => {
  it('reuses the existing customer when the phone belongs to a customer in the business', async () => {
    const row = orderRow();
    const tx = {
      business: { findUnique: vi.fn().mockResolvedValue({ id: 'business-1' }) },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'product-1',
            businessId: 'business-1',
            name: 'Producto',
            price: new Prisma.Decimal(100),
            isAvailable: true,
            optionGroups: [],
          },
        ]),
      },
      order: {
        aggregate: vi.fn().mockResolvedValue({ _max: { orderNumber: 0 } }),
        create: vi.fn().mockResolvedValue({ id: row.id }),
      },
      customer: {
        upsert: vi.fn().mockResolvedValue({
          id: 'customer-1',
          businessId: 'business-1',
          name: 'Nombre original',
          phone: '6691234567',
          createdAt: new Date(),
          updatedAt: new Date(),
        }),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
      order: { findUnique: vi.fn().mockResolvedValue(row) },
    } as unknown as PrismaClient;

    await new PrismaOrderRepository(prisma).create('business-1', {
      customer: { name: 'Nombre del pedido', phone: phoneSchema.parse('(669) 123-4567') },
      items: [{ productId: 'product-1', quantity: 1 }],
    });

    expect(tx.customer.upsert).toHaveBeenCalledWith({
      where: { businessId_phone: { businessId: 'business-1', phone: '6691234567' } },
      create: { businessId: 'business-1', name: 'Nombre del pedido', phone: '6691234567' },
      update: {},
    });
    expect(tx.order.create.mock.calls[0]?.[0].data.source).toBe('PUBLIC');
    expect(tx.order.create).toHaveBeenCalled();
  });

  it('creates a restaurant order without inventing a customer or phone', async () => {
    const row = {
      ...orderRow(),
      source: 'RESTAURANT' as const,
      customerId: null,
      customerPhone: null,
      subtotal: new Prisma.Decimal(200),
      total: new Prisma.Decimal(200),
    };
    const tx = {
      business: { findUnique: vi.fn().mockResolvedValue({ id: 'business-1' }) },
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 'product-1',
            businessId: 'business-1',
            name: 'Producto',
            price: new Prisma.Decimal(100),
            isAvailable: true,
            optionGroups: [],
          },
        ]),
      },
      order: {
        aggregate: vi.fn().mockResolvedValue({ _max: { orderNumber: 30 } }),
        create: vi.fn().mockResolvedValue({ id: row.id }),
      },
      customer: { upsert: vi.fn() },
    };
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ businessId: 'business-1' }) },
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
      order: { findUnique: vi.fn().mockResolvedValue(row) },
    } as unknown as PrismaClient;

    const result = await new PrismaOrderRepository(prisma).createForRestaurant(
      'user-1',
      'business-1',
      { customer: { name: 'Juan', phone: null }, items: [{ productId: 'product-1', quantity: 2 }] },
    );

    expect(result.toJSON()).toMatchObject({
      source: 'RESTAURANT',
      status: 'PENDING',
      customerId: null,
      customerPhone: null,
      total: 200,
    });
    expect(tx.customer.upsert).not.toHaveBeenCalled();
    expect(tx.order.create.mock.calls[0]?.[0].data).toMatchObject({
      source: 'RESTAURANT',
      customerId: undefined,
      customerPhone: null,
    });
  });

  it('rejects a restaurant order for another business', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ businessId: 'business-1' }) },
    } as unknown as PrismaClient;

    await expect(
      new PrismaOrderRepository(prisma).createForRestaurant('user-1', 'business-2', {
        customer: { name: null, phone: null },
        items: [{ productId: 'product-1', quantity: 1 }],
      }),
    ).rejects.toMatchObject({ statusCode: 403, code: 'ORDER_BUSINESS_ACCESS_DENIED' });
  });
});

describe('PrismaOrderRepository order search', () => {
  it('searches within the authorized business by number, name, or normalized phone', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ businessId: 'business-1' }) },
      order: { findMany, count },
      $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    } as unknown as PrismaClient;

    await new PrismaOrderRepository(prisma).list('user-1', {
      businessId: 'business-1',
      status: 'PENDING',
      search: ' 669-123 4567 ',
      page: 2,
      limit: 20,
    });

    const where = findMany.mock.calls[0]![0].where;
    expect(where).toMatchObject({
      businessId: 'business-1',
      business: { users: { some: { id: 'user-1' } } },
      status: 'PENDING',
    });
    expect(where.OR).toEqual([
      { id: '669-123 4567' },
      { customerName: { contains: '669-123 4567', mode: 'insensitive' } },
      { customerPhone: { contains: '6691234567' } },
    ]);
    expect(findMany.mock.calls[0]![0]).toMatchObject({ skip: 20, take: 20 });
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('adds the exact order number predicate for numeric searches', async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue({ businessId: 'business-1' }) },
      order: { findMany, count },
      $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    } as unknown as PrismaClient;

    await new PrismaOrderRepository(prisma).list('user-1', {
      businessId: 'business-1',
      search: '1024',
      page: 1,
      limit: 20,
    });

    expect(findMany.mock.calls[0]![0].where.OR).toContainEqual({ orderNumber: 1024 });
  });

  it.each([10, 9, 29])(
    'filters globally before pagination when searching for order #%s',
    async (orderNumber) => {
      const rows = createOrderRows(30);
      const findMany = vi.fn(async (args: ListQuery) => applyListQuery(rows, args));
      const count = vi.fn(
        async (args: { where: Prisma.OrderWhereInput }) =>
          rows.filter((row) => matchesWhere(row, args.where)).length,
      );
      const prisma = createListPrisma(findMany, count);

      const result = await new PrismaOrderRepository(prisma).list('user-1', {
        businessId: 'business-1',
        page: 1,
        limit: 20,
        search: String(orderNumber),
      });

      expect(result.orders).toHaveLength(1);
      expect(result.orders[0]?.toJSON().orderNumber).toBe(orderNumber);
      expect(result.total).toBe(1);
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 20, orderBy: { createdAt: 'desc' } }),
      );
      expect(count).toHaveBeenCalledWith({ where: findMany.mock.calls[0]![0].where });
    },
  );

  it('keeps the newest-to-oldest order across unfiltered pages', async () => {
    const rows = createOrderRows(30);
    const findMany = vi.fn(async (args: ListQuery) => applyListQuery(rows, args));
    const count = vi.fn(
      async (args: { where: Prisma.OrderWhereInput }) =>
        rows.filter((row) => matchesWhere(row, args.where)).length,
    );
    const prisma = createListPrisma(findMany, count);
    const repository = new PrismaOrderRepository(prisma);

    const firstPage = await repository.list('user-1', {
      businessId: 'business-1',
      page: 1,
      limit: 20,
    });
    const secondPage = await repository.list('user-1', {
      businessId: 'business-1',
      page: 2,
      limit: 20,
    });

    expect(firstPage.orders.map((order) => order.toJSON().orderNumber)).toEqual(
      Array.from({ length: 20 }, (_, index) => 30 - index),
    );
    expect(secondPage.orders.map((order) => order.toJSON().orderNumber)).toEqual(
      Array.from({ length: 10 }, (_, index) => 10 - index),
    );
    expect(firstPage.total).toBe(30);
    expect(secondPage.total).toBe(30);
  });

  it('returns no rows and a filtered total when search does not match', async () => {
    const rows = createOrderRows(30);
    const findMany = vi.fn(async (args: ListQuery) => applyListQuery(rows, args));
    const count = vi.fn(
      async (args: { where: Prisma.OrderWhereInput }) =>
        rows.filter((row) => matchesWhere(row, args.where)).length,
    );
    const result = await new PrismaOrderRepository(createListPrisma(findMany, count)).list(
      'user-1',
      { businessId: 'business-1', page: 1, limit: 20, search: 'does-not-exist' },
    );

    expect(result.orders).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('combines search and status in both the rows and filtered total', async () => {
    const rows = createOrderRows(30);
    rows[1]!.status = 'READY';
    const findMany = vi.fn(async (args: ListQuery) => applyListQuery(rows, args));
    const count = vi.fn(
      async (args: { where: Prisma.OrderWhereInput }) =>
        rows.filter((row) => matchesWhere(row, args.where)).length,
    );
    const repository = new PrismaOrderRepository(createListPrisma(findMany, count));

    const matching = await repository.list('user-1', {
      businessId: 'business-1',
      page: 1,
      limit: 20,
      search: '29',
      status: 'READY',
    });
    const nonMatching = await repository.list('user-1', {
      businessId: 'business-1',
      page: 1,
      limit: 20,
      search: '29',
      status: 'PENDING',
    });

    expect(matching.orders.map((order) => order.toJSON().orderNumber)).toEqual([29]);
    expect(matching.total).toBe(1);
    expect(nonMatching.orders).toEqual([]);
    expect(nonMatching.total).toBe(0);
  });

  it('supports partial case-insensitive customer names and normalized phone searches', async () => {
    const rows = createOrderRows(30);
    rows[1]!.customerName = 'Cliente Especial';
    rows[1]!.customerPhone = '6621234567';
    const findMany = vi.fn(async (args: ListQuery) => applyListQuery(rows, args));
    const count = vi.fn(
      async (args: { where: Prisma.OrderWhereInput }) =>
        rows.filter((row) => matchesWhere(row, args.where)).length,
    );
    const repository = new PrismaOrderRepository(createListPrisma(findMany, count));

    const byName = await repository.list('user-1', {
      businessId: 'business-1',
      page: 1,
      limit: 20,
      search: 'especial',
    });
    const byPhone = await repository.list('user-1', {
      businessId: 'business-1',
      page: 1,
      limit: 20,
      search: '(662) 123-4567',
    });

    expect(byName.orders.map((order) => order.toJSON().orderNumber)).toEqual([29]);
    expect(byName.total).toBe(1);
    expect(byPhone.orders.map((order) => order.toJSON().orderNumber)).toEqual([29]);
    expect(byPhone.total).toBe(1);
  });

  it.each([
    ['today', '2026-10-05T07:00:00.000Z', '2026-10-06T07:00:00.000Z'],
    ['7d', '2026-09-29T07:00:00.000Z', '2026-10-06T07:00:00.000Z'],
    ['30d', '2026-09-06T07:00:00.000Z', '2026-10-06T07:00:00.000Z'],
    ['lastMonth', '2026-09-01T07:00:00.000Z', '2026-10-01T07:00:00.000Z'],
  ] as const)('adds the %s business-local period before pagination', async (period, start, end) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repository = new PrismaOrderRepository(
      createListPrisma(findMany, count, 'America/Mazatlan'),
    );

    await repository.list('user-1', {
      businessId: 'business-1',
      period,
      page: 2,
      limit: 20,
    });

    const query = findMany.mock.calls[0]![0];
    expect(query.where.createdAt).toEqual({ gte: new Date(start), lt: new Date(end) });
    expect(query.skip).toBe(20);
    expect(query.take).toBe(20);
    expect(count).toHaveBeenCalledWith({ where: query.where });
  });

  it('combines period, status, search, count, and pagination in one database filter', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-05T12:00:00.000Z'));
    const findMany = vi.fn().mockResolvedValue([]);
    const count = vi.fn().mockResolvedValue(0);
    const repository = new PrismaOrderRepository(
      createListPrisma(findMany, count, 'America/Mazatlan'),
    );

    await repository.list('user-1', {
      businessId: 'business-1',
      period: '30d',
      status: 'READY',
      search: '29',
      page: 2,
      limit: 20,
    });

    const query = findMany.mock.calls[0]![0];
    expect(query.where).toMatchObject({
      businessId: 'business-1',
      status: 'READY',
      createdAt: {
        gte: new Date('2026-09-06T07:00:00.000Z'),
        lt: new Date('2026-10-06T07:00:00.000Z'),
      },
      OR: expect.arrayContaining([{ orderNumber: 29 }]),
    });
    expect(query.skip).toBe(20);
    expect(query.take).toBe(20);
    expect(count).toHaveBeenCalledWith({ where: query.where });
  });

  afterEach(() => vi.useRealTimers());
});

type ListRow = Omit<ReturnType<typeof orderRow>, 'status'> & {
  status: 'PENDING' | 'PREPARING' | 'READY' | 'CANCELLED';
};
type ListQuery = {
  where: Prisma.OrderWhereInput;
  orderBy: { createdAt: 'desc' };
  skip: number;
  take: number;
};

function createListPrisma(
  findMany: ReturnType<typeof vi.fn>,
  count: ReturnType<typeof vi.fn>,
  timezone?: string,
): PrismaClient {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        businessId: 'business-1',
        business: timezone ? { settings: { timezone } } : undefined,
      }),
    },
    order: { findMany, count },
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
  } as unknown as PrismaClient;
}

function createOrderRows(total: number): ListRow[] {
  const now = Date.now();
  return Array.from({ length: total }, (_, index) => {
    const row = orderRow();
    const orderNumber = total - index;
    row.id = `order-${orderNumber}`;
    row.orderNumber = orderNumber;
    row.customerName = 'Cliente';
    row.customerPhone = `6691234${String(orderNumber).padStart(3, '0')}`;
    row.createdAt = new Date(now - index * 1_000);
    row.updatedAt = row.createdAt;
    return row;
  });
}

function applyListQuery(rows: ListRow[], query: ListQuery): ListRow[] {
  return rows
    .filter((row) => matchesWhere(row, query.where))
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
    .slice(query.skip, query.skip + query.take);
}

function matchesWhere(row: ListRow, where: Prisma.OrderWhereInput): boolean {
  if (where.businessId !== row.businessId) return false;
  if (where.status && where.status !== row.status) return false;
  if (where.createdAt && typeof where.createdAt === 'object') {
    const range = where.createdAt as { gte?: Date; lt?: Date };
    if (range.gte && row.createdAt < range.gte) return false;
    if (range.lt && row.createdAt >= range.lt) return false;
  }
  if (!where.OR) return true;

  return where.OR.some((condition) => {
    if ('id' in condition) return condition.id === row.id;
    if ('orderNumber' in condition) return condition.orderNumber === row.orderNumber;
    if ('customerName' in condition && condition.customerName) {
      const value = condition.customerName as { contains?: string };
      return value.contains
        ? row.customerName?.toLowerCase().includes(value.contains.toLowerCase())
        : false;
    }
    if ('customerPhone' in condition && condition.customerPhone) {
      const value = condition.customerPhone as { contains?: string };
      return value.contains ? row.customerPhone?.includes(value.contains) : false;
    }
    return false;
  });
}
