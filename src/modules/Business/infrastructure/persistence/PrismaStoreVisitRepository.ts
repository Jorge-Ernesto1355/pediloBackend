import { Prisma, PrismaClient } from '@prisma/client';
import type {
  StoreVisitEvent,
  StoreVisitRange,
  StoreVisitRepository,
  StoreVisitStatsRepositoryResult,
} from '../../application/ports/StoreVisitRepository.js';

export class PrismaStoreVisitRepository implements StoreVisitRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async recordVisit(event: StoreVisitEvent): Promise<boolean> {
    try {
      await this.prisma.storeVisit.create({ data: event });
      return true;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return false;
      }
      throw error;
    }
  }

  async getBusinessForStats(userId: string): Promise<{ id: string; timezone: string } | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        businessId: { not: null },
        business: { members: { some: { userId, role: 'OWNER' } } },
      },
      select: {
        businessId: true,
        business: { select: { settings: { select: { timezone: true } } } },
      },
    });
    if (!user?.businessId) return null;
    return {
      id: user.businessId,
      timezone: user.business?.settings?.timezone ?? 'America/Mazatlan',
    };
  }

  async getStats(
    businessId: string,
    ranges: { current: StoreVisitRange; previous: StoreVisitRange },
    timezone: string,
    granularity: 'hour' | 'day',
  ): Promise<StoreVisitStatsRepositoryResult> {
    const totals = await this.prisma.$queryRaw<StatsRow[]>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE v."visitedAt" >= ${ranges.current.start} AND v."visitedAt" < ${ranges.current.end}) AS "currentVisits",
        COUNT(DISTINCT v."visitorHash") FILTER (WHERE v."visitedAt" >= ${ranges.current.start} AND v."visitedAt" < ${ranges.current.end}) AS "currentUniqueVisitors",
        COUNT(*) FILTER (WHERE v."visitedAt" >= ${ranges.previous.start} AND v."visitedAt" < ${ranges.previous.end}) AS "previousVisits",
        COUNT(DISTINCT v."visitorHash") FILTER (WHERE v."visitedAt" >= ${ranges.previous.start} AND v."visitedAt" < ${ranges.previous.end}) AS "previousUniqueVisitors"
      FROM "StoreVisit" v
      WHERE v."businessId" = ${businessId}
        AND v."visitedAt" >= ${ranges.previous.start}
        AND v."visitedAt" < ${ranges.current.end}
    `);
    const bucket =
      granularity === 'hour'
        ? Prisma.sql`to_char(v."visitedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}, 'HH24')`
        : Prisma.sql`to_char(v."visitedAt" AT TIME ZONE 'UTC' AT TIME ZONE ${timezone}, 'YYYY-MM-DD')`;
    const daily = await this.prisma.$queryRaw<DailyRow[]>(Prisma.sql`
      SELECT 'current' AS "period", ${bucket} AS "bucket", COUNT(*) AS "visits"
      FROM "StoreVisit" v
      WHERE v."businessId" = ${businessId}
        AND v."visitedAt" >= ${ranges.current.start}
        AND v."visitedAt" < ${ranges.current.end}
      GROUP BY 1, 2
      UNION ALL
      SELECT 'previous' AS "period", ${bucket} AS "bucket", COUNT(*) AS "visits"
      FROM "StoreVisit" v
      WHERE v."businessId" = ${businessId}
        AND v."visitedAt" >= ${ranges.previous.start}
        AND v."visitedAt" < ${ranges.previous.end}
      GROUP BY 1, 2
      ORDER BY 1, 2
    `);
    const row = totals[0];
    return {
      current: {
        visits: toCount(row?.currentVisits),
        uniqueVisitors: toCount(row?.currentUniqueVisitors),
      },
      previous: {
        visits: toCount(row?.previousVisits),
        uniqueVisitors: toCount(row?.previousUniqueVisitors),
      },
      currentSeries: daily
        .filter((item) => item.period === 'current')
        .map(({ bucket, visits }) => ({ bucket, visits: toCount(visits) })),
      previousSeries: daily
        .filter((item) => item.period === 'previous')
        .map(({ bucket, visits }) => ({ bucket, visits: toCount(visits) })),
    };
  }
}

interface StatsRow {
  currentVisits: bigint | number;
  currentUniqueVisitors: bigint | number;
  previousVisits: bigint | number;
  previousUniqueVisitors: bigint | number;
}

interface DailyRow {
  period: 'current' | 'previous';
  bucket: string;
  visits: bigint | number;
}

function toCount(value: bigint | number | null | undefined): number {
  return value === null || value === undefined
    ? 0
    : typeof value === 'bigint'
      ? Number(value)
      : value;
}
