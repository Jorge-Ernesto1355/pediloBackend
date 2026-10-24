import { Prisma, PrismaClient } from '@prisma/client';
import type {
  SalesAggregation,
  SalesPeriod,
  SalesRepository,
} from '../../application/ports/SalesRepository.js';
import { AppError } from '@/shared/errors/app-error.js';
import { getBusinessPeriodRange } from '@/shared/time/business-period.js';

const saleStatuses = ['PREPARING', 'READY'];

interface TotalRow {
  currentTotal: Prisma.Decimal | number | null;
  currentCount: bigint | number;
}

interface HistoricalRow {
  historicalTotal: Prisma.Decimal | number | null;
  historicalCount: bigint | number;
}

export class PrismaSalesRepository implements SalesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async aggregate(ownerUserId: string, period: SalesPeriod): Promise<SalesAggregation> {
    const business = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        businessId: true,
        business: {
          select: {
            settings: { select: { timezone: true } },
          },
        },
      },
    });
    if (!business?.businessId) throw new AppError('Business not found', 404, 'BUSINESS_NOT_FOUND');
    const timezone = business.business?.settings?.timezone || 'America/Mazatlan';
    const now = new Date();
    const current = getBusinessPeriodRange(period, timezone, now);
    // PostgreSQL does not implicitly compare a native enum column with text
    // parameters produced by Prisma's raw-query builder.
    const statuses = Prisma.join(
      saleStatuses.map((status) => Prisma.sql`${status}::"OrderStatus"`),
    );
    const totals = await this.prisma.$queryRaw<TotalRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(o."total") FILTER (WHERE o."createdAt" >= ${current.start} AND o."createdAt" < ${current.end}), 0) AS "currentTotal",
        COUNT(*) FILTER (WHERE o."createdAt" >= ${current.start} AND o."createdAt" < ${current.end}) AS "currentCount"
      FROM "Order" o
      WHERE o."businessId" = ${business.businessId}
        AND o."status" IN (${statuses})
        AND o."createdAt" >= ${current.start}
        AND o."createdAt" < ${current.end}
    `);
    const historical = await this.prisma.$queryRaw<HistoricalRow[]>(Prisma.sql`
      WITH historical_orders AS MATERIALIZED (
        SELECT DISTINCT ON (duplicate_check."businessId", duplicate_check."orderNumber")
          duplicate_check."total", duplicate_check."id"
        FROM "Order" duplicate_check
        WHERE duplicate_check."businessId" = ${business.businessId}
          AND duplicate_check."status" IN (${statuses})
          AND duplicate_check."createdAt" < ${now}
        ORDER BY duplicate_check."businessId", duplicate_check."orderNumber", duplicate_check."createdAt" DESC, duplicate_check."id" DESC
      )
      SELECT
        COALESCE(SUM("total"), 0) AS "historicalTotal",
        COUNT(*) AS "historicalCount"
      FROM historical_orders
    `);
    const row = totals[0];
    const historicalRow = historical[0];
    return {
      current: { total: toNumber(row?.currentTotal), orderCount: toNumber(row?.currentCount) },
      historical: {
        total: toNumber(historicalRow?.historicalTotal),
        orderCount: toNumber(historicalRow?.historicalCount),
      },
      timezone,
    };
  }
}

function toNumber(value: Prisma.Decimal | number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'bigint'
    ? Number(value)
    : typeof value === 'number'
      ? value
      : value instanceof Prisma.Decimal
        ? value.toNumber()
        : Number(value);
}
