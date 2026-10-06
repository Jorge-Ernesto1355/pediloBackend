import type { SalesAggregation, SalesPeriod, SalesRepository } from '../ports/SalesRepository.js';

export interface SalesPoint {
  label: string;
  start: string;
  sales: number;
  orderCount: number;
}

export interface SalesDashboard {
  period: SalesPeriod;
  granularity: 'hour' | 'day';
  timezone: string;
  total: number;
  ordersCount: number;
  trend: number;
  averageTicket: number;
  points: SalesPoint[];
}

export class GetSalesDashboard {
  constructor(private readonly repository: SalesRepository) {}

  async execute(ownerUserId: string, period: SalesPeriod): Promise<SalesDashboard> {
    const aggregation = await this.repository.aggregate(
      ownerUserId,
      period,
      period === 'today' ? 'hour' : 'day',
    );

    const trend = calculateTrend(aggregation.current.total, aggregation.previous.total);

    return {
      period,
      granularity: period === 'today' ? 'hour' : 'day',
      timezone: aggregation.timezone,
      total: roundMoney(aggregation.current.total),
      ordersCount: aggregation.current.orderCount,
      trend,
      averageTicket: calculateAverageTicket(
        aggregation.current.total,
        aggregation.current.orderCount,
      ),
      points: buildPoints(period, aggregation),
    };
  }
}

function buildPoints(period: SalesPeriod, aggregation: SalesAggregation): SalesPoint[] {
  return aggregation.buckets.map((row) => ({
    label:
      period === 'today'
        ? hourLabel(row.bucket, aggregation.timezone)
        : dayLabel(row.bucket, period),
    start: bucketStart(row.bucket, period, aggregation.timezone),
    sales: roundMoney(row.sales),
    orderCount: row.orderCount,
  }));
}

export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current;
  return Math.round(((current - previous) / previous) * 100);
}

export function calculateAverageTicket(total: number, orderCount: number): number {
  return orderCount === 0 ? 0 : Math.round(total / orderCount);
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
  for (let index = 0; index < 3; index += 1) {
    instant = localMidnight - timezoneOffset(instant, timezone);
  }
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
