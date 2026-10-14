import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaAverageTicketRepository } from './PrismaAverageTicketRepository.js';

describe('PrismaAverageTicketRepository', () => {
  it('aggregates orders once using only eligible statuses and half-open ranges', async () => {
    const queryRaw = vi.fn().mockResolvedValue([
      {
        currentTotal: new Prisma.Decimal('12500.00'),
        currentCount: 125n,
        previousTotal: new Prisma.Decimal('11000.00'),
        previousCount: 125n,
        globalTotal: new Prisma.Decimal('50000.00'),
        globalCount: 500n,
      },
    ]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const repository = new PrismaAverageTicketRepository(prisma);
    const current = {
      start: new Date('2026-10-11T07:00:00.000Z'),
      end: new Date('2026-10-11T23:30:00.000Z'),
    };
    const previous = {
      start: new Date('2026-10-10T07:00:00.000Z'),
      end: new Date('2026-10-10T23:30:00.000Z'),
    };

    await expect(repository.aggregate('business-1', { current, previous })).resolves.toEqual({
      current: { totalSales: '12500.00', ordersCount: 125 },
      previous: { totalSales: '11000.00', ordersCount: 125 },
      global: { totalSales: '50000.00', ordersCount: 500 },
    });
    const query = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(query.sql).toContain('"status" IN');
    expect(query.sql).toContain('"createdAt" <');
    expect(query.sql).toContain('FILTER');
    expect(query.sql).not.toContain('CANCELLED');
  });

  it('propagates real database errors instead of treating them as empty periods', async () => {
    const databaseError = new Error('database unavailable');
    const prisma = {
      $queryRaw: vi.fn().mockRejectedValue(databaseError),
    } as unknown as PrismaClient;
    const repository = new PrismaAverageTicketRepository(prisma);
    const range = {
      start: new Date('2026-10-11T07:00:00.000Z'),
      end: new Date('2026-10-11T23:30:00.000Z'),
    };

    await expect(
      repository.aggregate('business-1', { current: range, previous: range }),
    ).rejects.toBe(databaseError);
  });
});
