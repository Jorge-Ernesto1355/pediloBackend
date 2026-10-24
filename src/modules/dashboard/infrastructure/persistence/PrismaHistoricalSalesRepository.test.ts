import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaHistoricalSalesRepository } from './PrismaHistoricalSalesRepository.js';

describe('PrismaHistoricalSalesRepository', () => {
  it('uses an independent historical query with the sale filters', async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ total: 3232, orderCount: 1n }]);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({ businessId: 'business-id' }),
      },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient;

    const result = await new PrismaHistoricalSalesRepository(prisma).aggregate('owner-id');
    const query = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;

    expect(query.sql).toContain('historical_orders AS MATERIALIZED');
    expect(query.sql).toContain('DISTINCT ON');
    expect(query.sql).toContain('o."createdAt" <');
    expect(query.sql).not.toContain('NOW()');
    expect(query.sql).not.toContain('CANCELLED');
    expect(result).toEqual({ total: 3232, orderCount: 1 });
  });
});
