import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaSalesRepository } from './PrismaSalesRepository.js';

describe('PrismaSalesRepository analytics timezone queries', () => {
  it('uses a complete hourly series and converts stored UTC timestamps through the business timezone', async () => {
    const queryRaw = vi.fn().mockResolvedValueOnce([{}]).mockResolvedValueOnce([]);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          businessId: 'business-id',
          business: { settings: { timezone: 'America/Mazatlan' } },
        }),
      },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient;

    await new PrismaSalesRepository(prisma).aggregate('owner-id', 'today', 'hour');

    const totalsQuery = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    const bucketsQuery = queryRaw.mock.calls[1]?.[0] as Prisma.Sql;
    expect(bucketsQuery.sql).toContain('generate_series');
    expect(bucketsQuery.sql).toContain('o."createdAt" AT TIME ZONE \'UTC\'');
    expect(bucketsQuery.sql).toContain("AT TIME ZONE 'UTC',");
    expect(bucketsQuery.sql).toContain('COALESCE(sales.sales, 0)');
    expect(totalsQuery.sql).toContain('"createdAt" >=');
  });

  it('groups day buckets in the business-local calendar and returns zero-fill series', async () => {
    const queryRaw = vi.fn().mockResolvedValueOnce([{}]).mockResolvedValueOnce([]);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          businessId: 'business-id',
          business: { settings: { timezone: 'America/Mazatlan' } },
        }),
      },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient;

    await new PrismaSalesRepository(prisma).aggregate('owner-id', '7d', 'day');

    const bucketsQuery = queryRaw.mock.calls[1]?.[0] as Prisma.Sql;
    expect(bucketsQuery.sql).toContain('generate_series');
    expect(bucketsQuery.sql).toContain("AT TIME ZONE 'UTC') AT TIME ZONE");
    expect(bucketsQuery.sql).toContain('LEFT JOIN sales USING (bucket)');
    expect(bucketsQuery.sql).toContain('COALESCE(sales.sales, 0)');
  });
});
