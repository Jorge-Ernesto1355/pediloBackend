import { Prisma, PrismaClient } from '@prisma/client';
import type {
  SalesAggregation,
  SalesPeriod,
  SalesRepository,
} from '../../application/ports/SalesRepository.js';
import { AppError } from '@/shared/errors/app-error.js';
import {
  addDays,
  addMonths,
  daysInMonth,
  getBusinessPeriodRange,
  localDate,
  zonedStart,
} from '@/shared/time/business-period.js';
import type { DateParts } from '@/shared/time/business-period.js';

const saleStatuses = ['PREPARING', 'READY'];

interface TotalRow {
  currentTotal: Prisma.Decimal | number | null;
  currentCount: bigint | number;
  previousTotal: Prisma.Decimal | number | null;
  previousCount: bigint | number;
}

interface BucketRow {
  bucket: number | string | Date;
  sales: Prisma.Decimal | number | null;
  orderCount: bigint | number;
}

export class PrismaSalesRepository implements SalesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async aggregate(
    ownerUserId: string,
    period: SalesPeriod,
    bucket: 'hour' | 'day',
  ): Promise<SalesAggregation> {
    const business = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        businessId: true,
        business: { select: { settings: { select: { timezone: true } } } },
      },
    });
    if (!business?.businessId) throw new AppError('Business not found', 404, 'BUSINESS_NOT_FOUND');
    const timezone = business.business?.settings?.timezone || 'America/Mazatlan';
    const now = new Date();
    const ranges = buildRanges(period, timezone, now);
    const { current, previous } = ranges;
    // PostgreSQL does not implicitly compare a native enum column with text
    // parameters produced by Prisma's raw-query builder.
    const statuses = Prisma.join(
      saleStatuses.map((status) => Prisma.sql`${status}::"OrderStatus"`),
    );
    const totals = await this.prisma.$queryRaw<TotalRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(o."total") FILTER (WHERE o."createdAt" >= ${previous.start} AND o."createdAt" < ${previous.end}), 0) AS "previousTotal",
        COUNT(*) FILTER (WHERE o."createdAt" >= ${previous.start} AND o."createdAt" < ${previous.end}) AS "previousCount",
        COALESCE(SUM(o."total") FILTER (WHERE o."createdAt" >= ${current.start} AND o."createdAt" < ${current.end}), 0) AS "currentTotal",
        COUNT(*) FILTER (WHERE o."createdAt" >= ${current.start} AND o."createdAt" < ${current.end}) AS "currentCount"
      FROM "Order" o
      WHERE o."businessId" = ${business.businessId}
        AND o."status" IN (${statuses})
        AND o."createdAt" >= ${previous.start}
        AND o."createdAt" < ${current.end}
    `);
    const buckets =
      bucket === 'hour'
        ? await this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
          WITH hours AS (
            SELECT generate_series(
              ${current.start}::timestamp,
              ${current.end}::timestamp - interval '1 hour',
              interval '1 hour'
            ) AS bucket
          ), sales AS (
            SELECT date_trunc(
                     'hour',
                     o."createdAt" AT TIME ZONE 'UTC',
                     ${timezone}
                   ) AT TIME ZONE 'UTC' AS bucket,
                   SUM(o."total") AS sales,
                   COUNT(*) AS "orderCount"
            FROM "Order" o
            WHERE o."businessId" = ${business.businessId} AND o."status" IN (${statuses})
              AND o."createdAt" >= ${current.start} AND o."createdAt" < ${current.end}
            GROUP BY 1
          )
          SELECT to_char(hours.bucket, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "bucket",
                 COALESCE(sales.sales, 0) AS "sales",
                 COALESCE(sales."orderCount", 0) AS "orderCount"
          FROM hours LEFT JOIN sales USING (bucket) ORDER BY hours.bucket
        `)
        : await this.prisma.$queryRaw<BucketRow[]>(Prisma.sql`
          WITH days AS (
            SELECT generate_series(
              ${isoDate(localDate(current.start, timezone))}::timestamp,
              ${isoDate(localDate(now, timezone))}::timestamp,
              interval '1 day'
            )::date AS bucket
          ), sales AS (
            SELECT ((o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::date AS bucket,
                   SUM(o."total") AS sales,
                   COUNT(*) AS "orderCount"
            FROM "Order" o
            WHERE o."businessId" = ${business.businessId} AND o."status" IN (${statuses})
              AND o."createdAt" >= ${current.start} AND o."createdAt" < ${current.end}
            GROUP BY 1
          )
          SELECT to_char(days.bucket, 'YYYY-MM-DD') AS "bucket",
                 COALESCE(sales.sales, 0) AS "sales",
                 COALESCE(sales."orderCount", 0) AS "orderCount"
          FROM days LEFT JOIN sales USING (bucket) ORDER BY days.bucket
        `);
    const row = totals[0];
    return {
      current: { total: toNumber(row?.currentTotal), orderCount: toNumber(row?.currentCount) },
      previous: { total: toNumber(row?.previousTotal), orderCount: toNumber(row?.previousCount) },
      buckets: buckets.map((item) => ({
        bucket: String(item.bucket),
        sales: toNumber(item.sales),
        orderCount: toNumber(item.orderCount),
      })),
      timezone,
    };
  }
}

interface Range {
  start: Date;
  end: Date;
}

function buildRanges(
  period: SalesPeriod,
  timezone: string,
  now: Date,
): { current: Range; previous: Range } {
  const today = localDate(now, timezone);
  if (period === 'today') {
    return {
      current: getBusinessPeriodRange('today', timezone, now),
      previous: {
        start: zonedStart(addDays(today, -1), timezone),
        end: zonedStart(today, timezone),
      },
    };
  }
  if (period === '7d') {
    return {
      current: getBusinessPeriodRange('7d', timezone, now),
      previous: {
        start: zonedStart(addDays(today, -13), timezone),
        end: zonedStart(addDays(today, -6), timezone),
      },
    };
  }
  if (period === '30d') {
    return {
      current: getBusinessPeriodRange('30d', timezone, now),
      previous: {
        start: zonedStart(addDays(today, -59), timezone),
        end: zonedStart(addDays(today, -29), timezone),
      },
    };
  }
  const monthStart = { year: today.year, month: today.month, day: 1 };
  const previousMonth = addMonths(monthStart, -1);
  const previousEnd = addDays(
    previousMonth,
    Math.min(today.day, daysInMonth(previousMonth.year, previousMonth.month)),
  );
  return {
    current: getBusinessPeriodRange('thisMonth', timezone, now),
    previous: {
      start: zonedStart(previousMonth, timezone),
      end: zonedStart(previousEnd, timezone),
    },
  };
}

function isoDate(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
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
