import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaStoreVisitRepository } from './PrismaStoreVisitRepository.js';

describe('PrismaStoreVisitRepository', () => {
  it('deduplicates on the database unique constraint', async () => {
    const duplicateError = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const prisma = {
      storeVisit: { create: vi.fn().mockRejectedValue(duplicateError) },
    } as unknown as PrismaClient;
    const repository = new PrismaStoreVisitRepository(prisma);
    await expect(
      repository.recordVisit({
        businessId: 'business-1',
        visitedAt: new Date('2026-10-16T18:00:00Z'),
        visitorHash: 'opaque-hash',
        dedupeBucket: new Date('2026-10-16T18:00:00Z'),
      }),
    ).resolves.toBe(false);
  });

  it('scopes business stats to an owner membership', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findFirst } } as unknown as PrismaClient;
    const repository = new PrismaStoreVisitRepository(prisma);
    await expect(repository.getBusinessForStats('user-1')).resolves.toBeNull();
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'user-1',
          businessId: { not: null },
          business: { members: { some: { userId: 'user-1', role: 'OWNER' } } },
        },
      }),
    );
  });

  it('aggregates distinct visitors with half-open ranges and groups both series by business timezone', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          currentVisits: 6n,
          currentUniqueVisitors: 4n,
          previousVisits: 3n,
          previousUniqueVisitors: 2n,
        },
      ])
      .mockResolvedValueOnce([
        { period: 'current', bucket: '2026-10-16', visits: 6n },
        { period: 'previous', bucket: '2026-10-15', visits: 3n },
      ]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const repository = new PrismaStoreVisitRepository(prisma);
    const ranges = {
      current: { start: new Date('2026-10-16T07:00:00Z'), end: new Date('2026-10-16T18:00:00Z') },
      previous: { start: new Date('2026-10-15T07:00:00Z'), end: new Date('2026-10-15T18:00:00Z') },
    };
    await expect(
      repository.getStats('business-1', ranges, 'America/Mazatlan', 'day'),
    ).resolves.toEqual({
      current: { visits: 6, uniqueVisitors: 4 },
      previous: { visits: 3, uniqueVisitors: 2 },
      currentSeries: [{ bucket: '2026-10-16', visits: 6 }],
      previousSeries: [{ bucket: '2026-10-15', visits: 3 }],
    });
    const totalsQuery = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    const dailyQuery = queryRaw.mock.calls[1]?.[0] as Prisma.Sql;
    expect(totalsQuery.sql).toContain('COUNT(DISTINCT v."visitorHash")');
    expect(totalsQuery.sql).toContain('v."visitedAt" <');
    expect(totalsQuery.sql).toContain('v."businessId" =');
    expect(dailyQuery.sql).toContain('AT TIME ZONE');
    expect(dailyQuery.sql).toContain('UNION ALL');
  });

  it('groups today visits into local hours', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          currentVisits: 1n,
          currentUniqueVisitors: 1n,
          previousVisits: 1n,
          previousUniqueVisitors: 1n,
        },
      ])
      .mockResolvedValueOnce([{ period: 'current', bucket: '10', visits: 1n }]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const repository = new PrismaStoreVisitRepository(prisma);
    const range = {
      current: { start: new Date('2026-10-16T07:00:00Z'), end: new Date('2026-10-16T18:00:00Z') },
      previous: { start: new Date('2026-10-15T07:00:00Z'), end: new Date('2026-10-15T18:00:00Z') },
    };
    const result = await repository.getStats('business-1', range, 'America/Mazatlan', 'hour');
    expect(result.currentSeries).toEqual([{ bucket: '10', visits: 1 }]);
    const hourlyQuery = queryRaw.mock.calls[1]?.[0] as Prisma.Sql;
    expect(hourlyQuery.sql).toContain("'HH24'");
  });
});
