import { Prisma, PrismaClient } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import { PrismaGoogleReviewRepository } from './PrismaGoogleReviewRepository.js';

describe('PrismaGoogleReviewRepository', () => {
  it('scopes stats access to the authenticated owner membership', async () => {
    const findFirst = vi.fn().mockResolvedValue(null);
    const prisma = { user: { findFirst } } as unknown as PrismaClient;
    const repository = new PrismaGoogleReviewRepository(prisma);
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

  it('treats the unique link, visitor hash, and time bucket constraint as a duplicate', async () => {
    const duplicateError = new Prisma.PrismaClientKnownRequestError('duplicate', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const prisma = {
      googleReviewScan: { create: vi.fn().mockRejectedValue(duplicateError) },
    } as unknown as PrismaClient;
    const repository = new PrismaGoogleReviewRepository(prisma);
    await expect(
      repository.recordScan({
        businessId: 'business-1',
        googleReviewLinkId: 'link-1',
        visitedAt: new Date('2026-10-16T18:00:00Z'),
        visitorHash: 'opaque-hmac',
        dedupeBucket: new Date('2026-10-16T18:00:00Z'),
      }),
    ).resolves.toBe(false);
  });

  it('aggregates accepted scans and distinct visitors with half-open limits', async () => {
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([
        {
          currentScans: 5n,
          currentUniqueVisitors: 4n,
          previousScans: 3n,
          previousUniqueVisitors: 3n,
        },
      ])
      .mockResolvedValueOnce([{ date: '2026-10-16', scans: 5n }]);
    const prisma = { $queryRaw: queryRaw } as unknown as PrismaClient;
    const repository = new PrismaGoogleReviewRepository(prisma);
    const ranges = {
      current: { start: new Date('2026-10-16T07:00:00Z'), end: new Date('2026-10-16T18:00:00Z') },
      previous: { start: new Date('2026-10-15T07:00:00Z'), end: new Date('2026-10-16T07:00:00Z') },
    };
    await expect(repository.getStats('business-1', ranges, 'America/Mazatlan')).resolves.toEqual({
      current: { scans: 5, uniqueVisitors: 4 },
      previous: { scans: 3, uniqueVisitors: 3 },
      daily: [{ date: '2026-10-16', scans: 5 }],
    });
    const totalsQuery = queryRaw.mock.calls[0]?.[0] as Prisma.Sql;
    expect(totalsQuery.sql).toContain('COUNT(DISTINCT s."visitorHash")');
    expect(totalsQuery.sql).toContain('s."visitedAt" <');
    expect(totalsQuery.sql).toContain('s."businessId" =');
  });
});
