import type { SalesPeriod } from '../ports/SalesRepository.js';
import type { TrendRepository } from '../ports/TrendRepository.js';

interface TrendPoint {
  label: string;
  start: string;
  sales: number;
  orderCount: number;
}

export interface SalesTrend {
  period: SalesPeriod;
  granularity: 'hour' | 'day';
  timezone: string;
  trend: number;
  points: TrendPoint[];
  series: { current: TrendPoint[]; previous: TrendPoint[] };
  comparison: {
    current_total: number;
    previous_total: number;
    difference: number;
    percentage_change: number | null;
    status: 'OK' | 'NO_BASELINE';
  };
  tooltip: Array<{
    timestamp: string;
    label: string;
    current_sales: number;
    previous_sales: number;
    difference: number;
    percentage_change: number | null;
    current_orders_count: number;
    previous_orders_count: number;
    status: 'OK' | 'NO_BASELINE';
  }>;
}

export class GetSalesTrend {
  constructor(private readonly repository: TrendRepository) {}

  async execute(ownerUserId: string, period: SalesPeriod): Promise<SalesTrend> {
    const aggregation = await this.repository.aggregate(ownerUserId, period);
    const current = buildPoints(period, aggregation.buckets, aggregation.timezone);
    const previous = buildPoints(period, aggregation.previousBuckets, aggregation.timezone);
    return {
      period,
      granularity: period === 'today' ? 'hour' : 'day',
      timezone: aggregation.timezone,
      trend: calculateTrend(aggregation.current.total, aggregation.previous.total),
      points: current,
      series: { current, previous },
      comparison: buildComparison(aggregation.current.total, aggregation.previous.total),
      tooltip: buildTooltip(period, current, previous, aggregation.timezone),
    };
  }
}

export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 100);
}

function buildPoints(
  period: SalesPeriod,
  buckets: Array<{ bucket: string; sales: number; orderCount: number }>,
  timezone: string,
): TrendPoint[] {
  return buckets.map((row) => ({
    label: period === 'today' ? hourLabel(row.bucket, timezone) : dayLabel(row.bucket, period),
    start: bucketStart(row.bucket, period, timezone),
    sales: roundMoney(row.sales),
    orderCount: row.orderCount,
  }));
}

function buildComparison(current: number, previous: number) {
  const difference = roundMoney(current - previous);
  if (previous === 0) {
    return {
      current_total: roundMoney(current),
      previous_total: 0,
      difference,
      percentage_change: current === 0 ? 0 : null,
      status: current === 0 ? ('OK' as const) : ('NO_BASELINE' as const),
    };
  }
  return {
    current_total: roundMoney(current),
    previous_total: roundMoney(previous),
    difference,
    percentage_change: Number((((current - previous) / previous) * 100).toFixed(2)),
    status: 'OK' as const,
  };
}

function buildTooltip(
  period: SalesPeriod,
  current: TrendPoint[],
  previous: TrendPoint[],
  timezone: string,
) {
  const length = Math.max(current.length, previous.length);
  return Array.from({ length }, (_, index) => {
    const currentPoint = current[index] ?? zeroPoint(period, previous[index], timezone);
    const previousPoint = previous[index] ?? zeroPoint(period, current[index], timezone);
    const comparison = buildComparison(currentPoint.sales, previousPoint.sales);
    return {
      timestamp: currentPoint.start,
      label: currentPoint.label,
      current_sales: currentPoint.sales,
      previous_sales: previousPoint.sales,
      difference: comparison.difference,
      percentage_change: comparison.percentage_change,
      current_orders_count: currentPoint.orderCount,
      previous_orders_count: previousPoint.orderCount,
      status: comparison.status,
    };
  });
}

function zeroPoint(period: SalesPeriod, reference: TrendPoint | undefined, timezone: string) {
  if (!reference) return { label: '', start: new Date(0).toISOString(), sales: 0, orderCount: 0 };
  return {
    label: reference.label,
    start: bucketStart(reference.start, period, timezone),
    sales: 0,
    orderCount: 0,
  };
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function hourLabel(bucket: string, timezone: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(bucket));
}

function dayLabel(bucket: string, period: SalesPeriod): string {
  const date = new Date(`${bucket.slice(0, 10)}T00:00:00.000Z`);
  if (period === '7d') {
    return new Intl.DateTimeFormat('es-MX', { timeZone: 'UTC', weekday: 'short', day: 'numeric' })
      .format(date)
      .replace('.', '');
  }
  return bucket.slice(8, 10);
}

function bucketStart(bucket: string, period: SalesPeriod, timezone: string): string {
  if (period === 'today') return new Date(bucket).toISOString();
  const [year = 0, month = 0, day = 0] = bucket.slice(0, 10).split('-').map(Number);
  const localMidnight = Date.UTC(year, month - 1, day);
  let instant = localMidnight;
  for (let index = 0; index < 3; index += 1)
    instant = localMidnight - timezoneOffset(instant, timezone);
  return new Date(instant).toISOString();
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
