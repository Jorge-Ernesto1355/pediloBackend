import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaCustomerDiscountRepository } from './PrismaCustomerDiscountRepository.js';

const discountRow = {
  id: 'discount-1',
  businessId: 'business-1',
  customerId: 'customer-1',
  grantedFromOrderId: 'order-1',
  usedOrderId: null,
  type: 'PERCENTAGE' as const,
  value: new Prisma.Decimal(15),
  status: 'AVAILABLE' as const,
  expiresAt: new Date('2026-11-30T00:00:00.000Z'),
  reservedAt: null,
  usedAt: null,
  createdAt: new Date('2026-10-31T00:00:00.000Z'),
  updatedAt: new Date('2026-10-31T00:00:00.000Z'),
};

describe('PrismaCustomerDiscountRepository', () => {
  it('derives business and customer from an authorized order when granting', async () => {
    const tx = {
      order: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'order-1',
          businessId: 'business-1',
          customerId: 'customer-1',
        }),
      },
      customerDiscount: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue(discountRow),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    const result = await new PrismaCustomerDiscountRepository(prisma).grantForOrder(
      'owner-1',
      'order-1',
      { type: 'PERCENTAGE', value: 15 },
    );

    expect(tx.order.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'order-1',
          business: {
            members: { some: { userId: 'owner-1', role: { in: ['OWNER', 'ADMIN'] } } },
          },
        }),
      }),
    );
    expect(tx.customerDiscount.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          businessId: 'business-1',
          customerId: 'customer-1',
          grantedFromOrderId: 'order-1',
          type: 'PERCENTAGE',
          value: new Prisma.Decimal(15),
          status: 'AVAILABLE',
        }),
      }),
    );
    expect(result).toMatchObject({ id: 'discount-1', value: 15, status: 'AVAILABLE' });
  });

  it('refuses a second active discount for the same customer and business', async () => {
    const tx = {
      order: {
        findFirst: vi.fn().mockResolvedValue({
          id: 'order-1',
          businessId: 'business-1',
          customerId: 'customer-1',
        }),
      },
      customerDiscount: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue({ id: 'existing-discount' }),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      new PrismaCustomerDiscountRepository(prisma).grantForOrder('owner-1', 'order-1', {
        type: 'FIXED_AMOUNT',
        value: 50,
      }),
    ).rejects.toMatchObject({ code: 'CUSTOMER_DISCOUNT_ALREADY_ACTIVE', statusCode: 409 });
    expect(tx.customerDiscount.create).not.toHaveBeenCalled();
  });

  it('does not create a discount from an order outside the authenticated business', async () => {
    const tx = {
      order: { findFirst: vi.fn().mockResolvedValue(null) },
      customerDiscount: {
        updateMany: vi.fn(),
        findFirst: vi.fn(),
        create: vi.fn(),
      },
    };
    const prisma = {
      $transaction: vi.fn((callback: (transaction: typeof tx) => unknown) => callback(tx)),
    } as unknown as PrismaClient;

    await expect(
      new PrismaCustomerDiscountRepository(prisma).grantForOrder('other-owner', 'order-1', {
        type: 'PERCENTAGE',
        value: 10,
      }),
    ).rejects.toMatchObject({ code: 'ORDER_NOT_FOUND', statusCode: 404 });
    expect(tx.customerDiscount.create).not.toHaveBeenCalled();
  });

  it('resolves checkout discounts by normalized phone and exact business', async () => {
    const prisma = {
      customer: {
        findUnique: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      customerDiscount: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findFirst: vi.fn().mockResolvedValue(discountRow),
      },
    } as unknown as PrismaClient;

    const result = await new PrismaCustomerDiscountRepository(prisma).getForCheckout(
      'business-1',
      '6981119319',
    );

    expect(prisma.customer.findUnique).toHaveBeenCalledWith({
      where: { businessId_phone: { businessId: 'business-1', phone: '6981119319' } },
      select: { id: true },
    });
    expect(result).toMatchObject({ id: 'discount-1', type: 'PERCENTAGE', value: 15 });
  });
});
