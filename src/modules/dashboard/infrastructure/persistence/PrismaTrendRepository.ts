import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/shared/errors/app-error.js';
import { localDate } from '@/shared/time/business-period.js';
import { buildSalesRanges } from '@/shared/time/sales-period-ranges.js';
import type { SalesPeriod } from '../../application/ports/SalesRepository.js';
import type { TrendAggregation, TrendRepository } from '../../application/ports/TrendRepository.js';

interface TrendRow {
  currentTotal: Prisma.Decimal | number | null;
  previousTotal: Prisma.Decimal | number | null;
}

interface BucketRow {
  series: 'current' | 'previous';
  bucket: number | string | Date;
  sales: Prisma.Decimal | number | null;
  orderCount: bigint | number;
}

const saleStatuses = Prisma.join(
  ['PREPARING', 'READY'].map((status) => Prisma.sql`${status}::"OrderStatus"`),
);

export class PrismaTrendRepository implements TrendRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async aggregate(ownerUserId: string, period: SalesPeriod): Promise<TrendAggregation> {
    const business = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        businessId: true,
        business: { select: { settings: { select: { timezone: true } } } },
      },
    });
    if (!business?.businessId) throw new AppError('Business not found', 404, 'BUSINESS_NOT_FOUND');
    const timezone = business.business?.settings?.timezone ?? 'America/Mazatlan';
    const { current, previous } = buildSalesRanges(period, timezone, new Date());
    const rows = await this.prisma.$queryRaw<TrendRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(o."total") FILTER (WHERE o."createdAt" >= ${current.start} AND o."createdAt" < ${current.end}), 0) AS "currentTotal",
        COALESCE(SUM(o."total") FILTER (WHERE o."createdAt" >= ${previous.start} AND o."createdAt" < ${previous.end}), 0) AS "previousTotal"
      FROM "Order" o
      WHERE o."businessId" = ${business.businessId}
        AND o."status" IN (${saleStatuses})
        AND o."createdAt" >= ${previous.start}
        AND o."createdAt" < ${current.end}
    `);
    const bucketRows = await this.prisma.$queryRaw<BucketRow[]>(
      period === 'today'
        ? Prisma.sql`
          WITH current_hours AS (
            SELECT generate_series(${current.start}::timestamp, ${current.end}::timestamp - interval '1 hour', interval '1 hour') AS bucket
          ), previous_hours AS (
            SELECT generate_series(${previous.start}::timestamp, ${previous.end}::timestamp - interval '1 hour', interval '1 hour') AS bucket
          ), current_sales AS (
            SELECT date_trunc('hour', o."createdAt" AT TIME ZONE 'UTC', ${timezone}) AT TIME ZONE 'UTC' AS bucket, SUM(o."total") AS sales, COUNT(*) AS "orderCount"
            FROM "Order" o WHERE o."businessId" = ${business.businessId} AND o."status" IN (${saleStatuses}) AND o."createdAt" >= ${current.start} AND o."createdAt" < ${current.end} GROUP BY 1
          ), previous_sales AS (
            SELECT date_trunc('hour', o."createdAt" AT TIME ZONE 'UTC', ${timezone}) AT TIME ZONE 'UTC' AS bucket, SUM(o."total") AS sales, COUNT(*) AS "orderCount"
            FROM "Order" o WHERE o."businessId" = ${business.businessId} AND o."status" IN (${saleStatuses}) AND o."createdAt" >= ${previous.start} AND o."createdAt" < ${previous.end} GROUP BY 1
          )
          SELECT 'current' AS "series", to_char(current_hours.bucket, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "bucket", COALESCE(current_sales.sales, 0) AS "sales", COALESCE(current_sales."orderCount", 0) AS "orderCount" FROM current_hours LEFT JOIN current_sales USING (bucket)
          UNION ALL
          SELECT 'previous' AS "series", to_char(previous_hours.bucket, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "bucket", COALESCE(previous_sales.sales, 0) AS "sales", COALESCE(previous_sales."orderCount", 0) AS "orderCount" FROM previous_hours LEFT JOIN previous_sales USING (bucket)
          ORDER BY "series", "bucket"
        `
        : Prisma.sql`
          WITH current_days AS (
            SELECT generate_series(${isoDate(localDate(current.start, timezone))}::timestamp, ${isoDate(localDate(current.end, timezone))}::timestamp - interval '1 day', interval '1 day')::date AS bucket
          ), previous_days AS (
            SELECT generate_series(${isoDate(localDate(previous.start, timezone))}::timestamp, ${isoDate(localDate(previous.end, timezone))}::timestamp - interval '1 day', interval '1 day')::date AS bucket
          ), current_sales AS (
            SELECT ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date AS bucket, SUM(o."total") AS sales, COUNT(*) AS "orderCount"
            FROM "Order" o WHERE o."businessId" = ${business.businessId} AND o."status" IN (${saleStatuses}) AND o."createdAt" >= ${current.start} AND o."createdAt" < ${current.end} GROUP BY 1
          ), previous_sales AS (
            SELECT ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date AS bucket, SUM(o."total") AS sales, COUNT(*) AS "orderCount"
            FROM "Order" o WHERE o."businessId" = ${business.businessId} AND o."status" IN (${saleStatuses}) AND o."createdAt" >= ${previous.start} AND o."createdAt" < ${previous.end} GROUP BY 1
          )
          SELECT 'current' AS "series", to_char(current_days.bucket, 'YYYY-MM-DD') AS "bucket", COALESCE(current_sales.sales, 0) AS "sales", COALESCE(current_sales."orderCount", 0) AS "orderCount" FROM current_days LEFT JOIN current_sales USING (bucket)
          UNION ALL
          SELECT 'previous' AS "series", to_char(previous_days.bucket, 'YYYY-MM-DD') AS "bucket", COALESCE(previous_sales.sales, 0) AS "sales", COALESCE(previous_sales."orderCount", 0) AS "orderCount" FROM previous_days LEFT JOIN previous_sales USING (bucket)
          ORDER BY "series", "bucket"
        `,
    );
    const row = rows[0];
    const toBucket = (item: BucketRow) => ({
      bucket: String(item.bucket),
      sales: toNumber(item.sales),
      orderCount: toCount(item.orderCount),
    });
    return {
      current: { total: toNumber(row?.currentTotal), orderCount: 0 },
      previous: { total: toNumber(row?.previousTotal), orderCount: 0 },
      buckets: bucketRows.filter((item) => item.series === 'current').map(toBucket),
      previousBuckets: bucketRows.filter((item) => item.series === 'previous').map(toBucket),
      timezone,
    };
  }
}

function toNumber(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return value instanceof Prisma.Decimal ? value.toNumber() : Number(value);
}

function toCount(value: bigint | number): number {
  return typeof value === 'bigint' ? Number(value) : value;
}

function isoDate(parts: { year: number; month: number; day: number }): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}
