import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaSalesRepository } from './PrismaSalesRepository.js';

describe('PrismaSalesRepository sales totals query', () => {
  it('loads period and historical totals in one query with sale filters and deduplication', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ currentTotal: 10, currentCount: 1n }])
      .mockResolvedValueOnce([{ historicalTotal: 100, historicalCount: 3n }]);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          businessId: 'business-id',
          business: {
            settings: { timezone: 'America/Mazatlan' },
          },
        }),
      },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient;

    const result = await new PrismaSalesRepository(prisma).aggregate('owner-id', 'today');
    const totalsQuery = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    const historicalQuery = queryRaw.mock.calls[1]?.[0] as Prisma.Sql;

    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(totalsQuery.sql).not.toContain('historical_orders');
    expect(historicalQuery.sql).toContain('historical_orders AS MATERIALIZED');
    expect(historicalQuery.sql).toContain('DISTINCT ON');
    expect(historicalQuery.sql).toContain('duplicate_check."createdAt" <');
    expect(historicalQuery.sql).not.toContain('CANCELLED');
    expect(result).toMatchObject({
      current: { total: 10, orderCount: 1 },
      historical: { total: 100, orderCount: 3 },
      timezone: 'America/Mazatlan',
    });
  });
});
