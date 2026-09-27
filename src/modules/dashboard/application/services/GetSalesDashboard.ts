import type {
  SalesAggregation,
  SalesBucket,
  SalesPeriod,
  SalesRepository,
} from '../ports/SalesRepository.js';

export interface SalesPoint {
  label: string;
  sales: number;
  orderCount: number;
}

export interface SalesDashboard {
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

    return {
      total: roundMoney(aggregation.current.total),
      ordersCount: aggregation.current.orderCount,
      trend: calculateTrend(aggregation.current.total, aggregation.previous.total),
      averageTicket: calculateAverageTicket(
        aggregation.current.total,
        aggregation.current.orderCount,
      ),
      points: buildPoints(period, aggregation),
    };
  }
}

interface DateParts {
  year: number;
  month: number;
  day: number;
}

const weekdays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function buildPoints(period: SalesPeriod, aggregation: SalesAggregation): SalesPoint[] {
  if (period === 'today') return buildTodayPoints(aggregation.buckets);
  if (period === '7d') return buildSevenDayPoints(aggregation.buckets, aggregation.timezone);
  if (period === '30d') return buildThirtyDayPoints(aggregation.buckets, aggregation.timezone);
  return buildMonthPoints(aggregation.buckets, aggregation.timezone);
}

function buildTodayPoints(buckets: SalesBucket[]): SalesPoint[] {
  const values = [0, 0, 0, 0, 0];
  const orderCounts = [0, 0, 0, 0, 0];
  for (const row of buckets) {
    const hour = Number(row.bucket);
    const index = hour < 12 ? 0 : hour < 15 ? 1 : hour < 18 ? 2 : hour < 21 ? 3 : 4;
    values[index] = (values[index] ?? 0) + row.sales;
    orderCounts[index] = (orderCounts[index] ?? 0) + row.orderCount;
  }
  return ['9 am', '12 pm', '3 pm', '6 pm', '9 pm'].map((label, index) => ({
    label,
    sales: roundMoney(values[index] ?? 0),
    orderCount: orderCounts[index] ?? 0,
  }));
}

function buildSevenDayPoints(buckets: SalesBucket[], timezone: string): SalesPoint[] {
  const today = dateOnly(new Date(), timezone);
  const values = new Map(
    buckets.map((row) => [
      row.bucket.slice(0, 10),
      { sales: row.sales, orderCount: row.orderCount },
    ]),
  );
  return Array.from({ length: 7 }, (_, index) => {
    const date = addDays(today, index - 6);
    const key = isoDate(date);
    const value = values.get(key);
    return {
      label: weekdays[weekday(date)] ?? '',
      sales: roundMoney(value?.sales ?? 0),
      orderCount: value?.orderCount ?? 0,
    };
  });
}

function buildThirtyDayPoints(buckets: SalesBucket[], timezone: string): SalesPoint[] {
  const today = dateOnly(new Date(), timezone);
  const start = addDays(today, -29);
  const values = new Map<number, number>();
  const orderCounts = new Map<number, number>();
  for (const row of buckets) {
    const date = parseDate(row.bucket);
    const index =
      Math.round(
        (Date.UTC(date.year, date.month - 1, date.day) -
          Date.UTC(start.year, start.month - 1, start.day)) /
          86_400_000,
      ) + 1;
    const point = index === 30 ? 6 : Math.floor((index - 1) / 5);
    values.set(point, (values.get(point) ?? 0) + row.sales);
    orderCounts.set(point, (orderCounts.get(point) ?? 0) + row.orderCount);
  }
  return [1, 6, 11, 16, 21, 26, 30].map((label, index) => ({
    label: String(label),
    sales: roundMoney(values.get(index) ?? 0),
    orderCount: orderCounts.get(index) ?? 0,
  }));
}

function buildMonthPoints(buckets: SalesBucket[], timezone: string): SalesPoint[] {
  const values = new Map<number, number>();
  const orderCounts = new Map<number, number>();
  for (const row of buckets) {
    const day = parseDate(row.bucket).day;
    const week = Math.floor((day - 1) / 7) + 1;
    values.set(week, (values.get(week) ?? 0) + row.sales);
    orderCounts.set(week, (orderCounts.get(week) ?? 0) + row.orderCount);
  }
  const count = Math.max(1, Math.ceil(dateOnly(new Date(), timezone).day / 7));
  return Array.from({ length: count }, (_, index) => ({
    label: `Sem ${index + 1}`,
    sales: roundMoney(values.get(index + 1) ?? 0),
    orderCount: orderCounts.get(index + 1) ?? 0,
  }));
}

export function calculateTrend(current: number, previous: number): number {
  if (previous === 0) return current === 0 ? 0 : 100;
  return Math.round(((current - previous) / previous) * 100);
}

export function calculateAverageTicket(total: number, orderCount: number): number {
  return orderCount === 0 ? 0 : Math.round(total / orderCount);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function dateOnly(date: Date, timezone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

function parseDate(value: string): DateParts {
  const [year = 0, month = 0, day = 0] = value.slice(0, 10).split('-').map(Number);
  return { year, month, day };
}

function isoDate(parts: DateParts): string {
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

function addDays(parts: DateParts, days: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

function weekday(parts: DateParts): number {
  return new Date(Date.UTC(parts.year, parts.month - 1, parts.day)).getUTCDay();
}
