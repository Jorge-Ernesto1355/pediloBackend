import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
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
  it('rejects an order when the phone already belongs to a customer in the business', async () => {
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
        create: vi.fn().mockResolvedValue(row),
      },
      customer: {
        findFirst: vi.fn().mockResolvedValue({
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
    } as unknown as PrismaClient;

    await expect(
      new PrismaOrderRepository(prisma).create('business-1', {
        customer: { name: 'Nombre del pedido', phone: phoneSchema.parse('(669) 123-4567') },
        items: [{ productId: 'product-1', quantity: 1 }],
      }),
    ).rejects.toMatchObject({ code: 'CUSTOMER_PHONE_ALREADY_EXISTS', statusCode: 409 });

    expect(tx.customer.findFirst).toHaveBeenCalledWith({
      where: { businessId: 'business-1', phone: '6691234567' },
    });
    expect(tx.order.create).not.toHaveBeenCalled();
  });
});
