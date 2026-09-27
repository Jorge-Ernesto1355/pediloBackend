import { PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { phoneSchema } from '@/shared/validation/phone.js';
import { PrismaCustomerRepository } from './PrismaCustomerRepository.js';

function prismaMock() {
  return {
    user: { findUnique: vi.fn().mockResolvedValue({ businessId: 'business-1' }) },
    customer: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({
        id: 'customer-1',
        businessId: 'business-1',
        name: 'Ana',
        phone: '6691234567',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
    },
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
});
