import type { PrismaClient } from '@prisma/client';
import type {
  GoogleReviewDetails,
  GoogleReviewLink,
  GoogleReviewRepository,
  GoogleReviewScan,
  GoogleReviewStatsRange,
  GoogleReviewStatsResult,
} from '../../domain/ports/GoogleReviewRepository.js';
import { Prisma } from '@prisma/client';

export class PrismaGoogleReviewRepository implements GoogleReviewRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async isOwner(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        businessId: { not: null },
        business: { members: { some: { userId, role: 'OWNER' } } },
      },
      select: { id: true },
    });
    return Boolean(user);
  }

  async getDetailsByOwnerUserId(userId: string): Promise<GoogleReviewDetails | null> {
    const row = await this.prisma.business.findFirst({
      where: { users: { some: { id: userId } } },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        coverUrl: true,
        googleReviewLink: true,
      },
    });
    if (!row) return null;
    return {
      business: { id: row.id, name: row.name, logoUrl: row.logoUrl, coverUrl: row.coverUrl },
      link: row.googleReviewLink,
    };
  }

  async upsertByOwnerUserId(userId: string, url: string): Promise<GoogleReviewLink> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { businessId: true },
    });
    if (!user.businessId) throw new Error('Owner has no business');
    return this.prisma.googleReviewLink.upsert({
      where: { businessId: user.businessId },
      create: { businessId: user.businessId, url },
      update: { url },
    });
  }

  async getRedirectByQrCode(qrCode: string): Promise<{ link: GoogleReviewLink } | null> {
    const link = await this.prisma.googleReviewLink.findUnique({ where: { qrCode } });
    return link ? { link } : null;
  }

  async recordScan(scan: GoogleReviewScan): Promise<boolean> {
    try {
      await this.prisma.googleReviewScan.create({ data: scan });
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
    ranges: { current: GoogleReviewStatsRange; previous: GoogleReviewStatsRange },
    timezone: string,
  ): Promise<GoogleReviewStatsResult> {
    const rows = await this.prisma.$queryRaw<StatsRow[]>(Prisma.sql`
      SELECT
        COUNT(*) FILTER (WHERE s."visitedAt" >= ${ranges.current.start} AND s."visitedAt" < ${ranges.current.end}) AS "currentScans",
        COUNT(DISTINCT s."visitorHash") FILTER (WHERE s."visitedAt" >= ${ranges.current.start} AND s."visitedAt" < ${ranges.current.end}) AS "currentUniqueVisitors",
        COUNT(*) FILTER (WHERE s."visitedAt" >= ${ranges.previous.start} AND s."visitedAt" < ${ranges.previous.end}) AS "previousScans",
        COUNT(DISTINCT s."visitorHash") FILTER (WHERE s."visitedAt" >= ${ranges.previous.start} AND s."visitedAt" < ${ranges.previous.end}) AS "previousUniqueVisitors"
      FROM "GoogleReviewScan" s
      WHERE s."businessId" = ${businessId}
        AND s."visitedAt" >= ${ranges.previous.start}
        AND s."visitedAt" < ${ranges.current.end}
    `);
    const dailyRows = await this.prisma.$queryRaw<DailyStatsRow[]>(Prisma.sql`
      SELECT to_char(s."visitedAt" AT TIME ZONE ${timezone}, 'YYYY-MM-DD') AS "date", COUNT(*) AS "scans"
      FROM "GoogleReviewScan" s
      WHERE s."businessId" = ${businessId}
        AND s."visitedAt" >= ${ranges.current.start}
        AND s."visitedAt" < ${ranges.current.end}
      GROUP BY 1
      ORDER BY 1
    `);
    const row = rows[0];
    return {
      current: {
        scans: toCount(row?.currentScans),
        uniqueVisitors: toCount(row?.currentUniqueVisitors),
      },
      previous: {
        scans: toCount(row?.previousScans),
        uniqueVisitors: toCount(row?.previousUniqueVisitors),
      },
      daily: dailyRows.map(({ date, scans }) => ({ date, scans: toCount(scans) })),
    };
  }
}

interface StatsRow {
  currentScans: bigint | number;
  currentUniqueVisitors: bigint | number;
  previousScans: bigint | number;
  previousUniqueVisitors: bigint | number;
}

interface DailyStatsRow {
  date: string;
  scans: bigint | number;
}

function toCount(value: bigint | number | null | undefined): number {
  return value === null || value === undefined
    ? 0
    : typeof value === 'bigint'
      ? Number(value)
      : value;
}
