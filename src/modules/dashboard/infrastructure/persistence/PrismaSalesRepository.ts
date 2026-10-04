import { Prisma, PrismaClient } from '@prisma/client';
import type {
  SalesAggregation,
  SalesPeriod,
  SalesRepository,
} from '../../application/ports/SalesRepository.js';
import { AppError } from '@/shared/errors/app-error.js';

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

interface DateParts {
  year: number;
  month: number;
  day: number;
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
  const tomorrow = addDays(today, 1);
  if (period === 'today') return pair(today, tomorrow, 1, timezone);
  if (period === '7d') return pair(addDays(today, -6), tomorrow, 7, timezone);
  if (period === '30d') return pair(addDays(today, -29), tomorrow, 30, timezone);
  const monthStart = { year: today.year, month: today.month, day: 1 };
  const previousMonth = addMonths(monthStart, -1);
  const previousEnd = addDays(
    previousMonth,
    Math.min(today.day, daysInMonth(previousMonth.year, previousMonth.month)),
  );
  return {
    current: { start: zonedStart(monthStart, timezone), end: now },
    previous: {
      start: zonedStart(previousMonth, timezone),
      end: zonedStart(previousEnd, timezone),
    },
  };
}

function pair(
  start: DateParts,
  end: DateParts,
  days: number,
  timezone: string,
): { current: Range; previous: Range } {
  return {
    current: { start: zonedStart(start, timezone), end: zonedStart(end, timezone) },
    previous: {
      start: zonedStart(addDays(start, -days), timezone),
      end: zonedStart(start, timezone),
    },
  };
}

function localDate(date: Date, timezone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value ?? 0),
    month: Number(parts.find((part) => part.type === 'month')?.value ?? 0),
    day: Number(parts.find((part) => part.type === 'day')?.value ?? 0),
  };
}

function zonedStart(parts: DateParts, timezone: string): Date {
  const localUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let instant = localUtc;
  for (let index = 0; index < 3; index += 1) instant = localUtc - timezoneOffset(instant, timezone);
  return new Date(instant);
}

function timezoneOffset(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (
    Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    ) - instant
  );
}

function addDays(parts: DateParts, days: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function addMonths(parts: DateParts, months: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: 1 };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
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
