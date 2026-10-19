import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { phoneSchema } from '@/shared/validation/phone.js';
import { PrismaCustomerRepository } from './PrismaCustomerRepository.js';

function prismaMock() {
  return {
    user: { findUnique: vi.fn().mockResolvedValue({ businessId: 'business-1' }) },
    customer: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({
        id: 'customer-1',
        businessId: 'business-1',
        name: 'Ana',
        phone: '6691234567',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
    $transaction: vi.fn((operations: Promise<unknown>[]) => Promise.all(operations)),
  } as unknown as PrismaClient;
}

describe('PrismaCustomerRepository phone identity', () => {
  it('uses business and normalized phone as the identity', async () => {
    const prisma = prismaMock();
    const repository = new PrismaCustomerRepository(prisma);
    await repository.create('user-1', 'business-1', {
      name: 'Ana',
      phone: phoneSchema.parse('(669) 123-4567'),
    });
    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: { businessId: 'business-1', name: 'Ana', phone: '6691234567' },
    });
  });

  it('keeps the same phone separate across businesses', async () => {
    const prisma = prismaMock();
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ businessId: 'business-2' } as never);
    const repository = new PrismaCustomerRepository(prisma);
    await repository.create('user-1', 'business-2', { name: 'Ana', phone: '6691234567' });
    expect(prisma.customer.create).toHaveBeenCalledWith({
      data: { businessId: 'business-2', name: 'Ana', phone: '6691234567' },
    });
  });

  it('rejects a phone that already belongs to another customer in the same business', async () => {
    const prisma = prismaMock();
    vi.mocked(prisma.customer.findFirst).mockResolvedValue({ id: 'existing-customer' } as never);
    const repository = new PrismaCustomerRepository(prisma);
    await expect(
      repository.create('user-1', 'business-1', { name: 'Otra persona', phone: '6691234567' }),
    ).rejects.toMatchObject({ code: 'CUSTOMER_PHONE_ALREADY_EXISTS', statusCode: 409 });
    expect(prisma.customer.create).not.toHaveBeenCalled();
  });

  it('returns the total spent using only preparing and ready orders', async () => {
    const prisma = prismaMock();
    vi.mocked(prisma.customer.findMany).mockResolvedValue([
      {
        id: 'customer-1',
        businessId: 'business-1',
        name: 'Ana',
        phone: '6691234567',
        createdAt: new Date(),
        updatedAt: new Date(),
        _count: { orders: 4 },
        orders: [{ total: new Prisma.Decimal(100) }, { total: new Prisma.Decimal(250.5) }],
      },
    ] as never);
    vi.mocked(prisma.customer.count).mockResolvedValue(1);

    const repository = new PrismaCustomerRepository(prisma);
    const result = await repository.list('user-1', {
      businessId: 'business-1',
      page: 1,
      limit: 20,
    });

    expect(result.customers[0]?.toJSON().totalSpent).toBe(350.5);
    expect(prisma.customer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          orders: {
            where: { status: { in: ['PREPARING', 'READY'] } },
            select: { total: true },
          },
        }),
      }),
    );
  });
});
