import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaTrendRepository } from './PrismaTrendRepository.js';

describe('PrismaTrendRepository', () => {
  it('loads only the two period totals with the existing sale statuses', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([{ currentTotal: 150, previousTotal: 100 }])
      .mockResolvedValueOnce([]);
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue({
          businessId: 'business-id',
          business: { settings: { timezone: 'America/Mazatlan' } },
        }),
      },
      $queryRaw: queryRaw,
    } as unknown as PrismaClient;

    const result = await new PrismaTrendRepository(prisma).aggregate('owner-id', '7d');
    const query = (queryRaw.mock.calls[0]?.[0] as Prisma.Sql).sql;

    expect(query).toContain('currentTotal');
    expect(query).toContain('previousTotal');
    expect(query).not.toContain('CANCELLED');
    expect(result).toEqual({
      current: { total: 150, orderCount: 0 },
      previous: { total: 100, orderCount: 0 },
      buckets: [],
      previousBuckets: [],
      timezone: 'America/Mazatlan',
    });
  });
});
