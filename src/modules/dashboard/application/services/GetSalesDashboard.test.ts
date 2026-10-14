import { afterEach, describe, expect, it, vi } from 'vitest';
import { calculateTrend, GetSalesDashboard } from './GetSalesDashboard.js';
import type { SalesAggregation, SalesPeriod, SalesRepository } from '../ports/SalesRepository.js';

const fixedNow = new Date('2026-09-29T12:00:00.000Z');

class FakeSalesRepository implements SalesRepository {
  constructor(private readonly aggregation: SalesAggregation) {}

  async aggregate(): Promise<SalesAggregation> {
    return this.aggregation;
  }
}

function aggregation(buckets: SalesAggregation['buckets'], timezone = 'UTC'): SalesAggregation {
  return {
    current: {
      total: buckets.reduce((sum, bucket) => sum + bucket.sales, 0),
      orderCount: buckets.reduce((sum, bucket) => sum + bucket.orderCount, 0),
    },
    previous: { total: 200, orderCount: 2 },
    buckets,
    previousBuckets: [],
    timezone,
  };
}

function dateBuckets(start: string, count: number) {
  const startDate = new Date(`${start}T00:00:00.000Z`);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(startDate.getTime() + index * 86_400_000).toISOString().slice(0, 10);
    return { bucket: date, sales: 0, orderCount: 0 };
  });
}

async function execute(period: SalesPeriod, data: SalesAggregation) {
  return new GetSalesDashboard(new FakeSalesRepository(data)).execute('user-id', period);
}

describe('GetSalesDashboard bucket granularity', () => {
  afterEach(() => vi.useRealTimers());

  it('returns one point per hour for today, including empty hours and summing multiple orders', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const buckets = Array.from({ length: 24 }, (_, hour) => ({
      bucket: `2026-09-29T${String(hour).padStart(2, '0')}:00:00.000Z`,
      sales: hour === 9 ? 100 : hour === 10 ? 80 : hour === 12 ? 250 : 0,
      orderCount: hour === 9 ? 2 : hour === 10 || hour === 12 ? 1 : 0,
    }));

    const result = await execute('today', aggregation(buckets));
    expect(result).toMatchObject({ period: 'today', granularity: 'hour', timezone: 'UTC' });
    expect(result.points).toHaveLength(24);
    expect(
      result.points
        .slice(9, 13)
        .map(({ label, sales, orderCount }) => ({ label, sales, orderCount })),
    ).toEqual([
      { label: '09:00', sales: 100, orderCount: 2 },
      { label: '10:00', sales: 80, orderCount: 1 },
      { label: '11:00', sales: 0, orderCount: 0 },
      { label: '12:00', sales: 250, orderCount: 1 },
    ]);
    expect(result.points[9]?.start).toBe('2026-09-29T09:00:00.000Z');
  });

  it('returns seven daily points including a zero-sales day', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const buckets = dateBuckets('2026-09-23', 7);
    buckets[0] = { bucket: '2026-09-23', sales: 450, orderCount: 8 };
    buckets[1] = { bucket: '2026-09-24', sales: 320, orderCount: 5 };
    buckets[3] = { bucket: '2026-09-26', sales: 210, orderCount: 4 };

    const result = await execute('7d', aggregation(buckets));
    expect(result.granularity).toBe('day');
    expect(result.points).toHaveLength(7);
    expect(result.points[2]).toMatchObject({ label: 'vie 25', sales: 0, orderCount: 0 });
    expect(result.points[0]?.start).toBe('2026-09-23T00:00:00.000Z');
  });

  it('returns thirty daily points rather than weekly groups', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const result = await execute('30d', aggregation(dateBuckets('2026-08-31', 30)));
    expect(result.granularity).toBe('day');
    expect(result.points).toHaveLength(30);
    expect(result.points[0]?.label).toBe('31');
    expect(result.points[29]?.label).toBe('29');
  });

  it('returns only month-to-date daily points, without future days', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    const result = await execute('thisMonth', aggregation(dateBuckets('2026-09-01', 29)));
    expect(result.granularity).toBe('day');
    expect(result.points).toHaveLength(29);
    expect(result.points[0]?.label).toBe('01');
    expect(result.points.at(-1)?.label).toBe('29');
  });

  it('converts UTC instants to the business timezone without relying on process timezone', async () => {
    const originalTz = process.env.TZ;
    try {
      process.env.TZ = 'UTC';
      const utcResult = await execute(
        'today',
        aggregation(
          [{ bucket: '2026-09-29T16:00:00.000Z', sales: 100, orderCount: 1 }],
          'America/Mazatlan',
        ),
      );
      process.env.TZ = 'Pacific/Auckland';
      const otherResult = await execute(
        'today',
        aggregation(
          [{ bucket: '2026-09-29T16:00:00.000Z', sales: 100, orderCount: 1 }],
          'America/Mazatlan',
        ),
      );
      expect(utcResult.points[0]?.label).toBe('09:00');
      expect(otherResult.points[0]?.label).toBe(utcResult.points[0]?.label);
    } finally {
      if (originalTz === undefined) delete process.env.TZ;
      else process.env.TZ = originalTz;
    }
  });

  it('keeps the business-local date across a UTC month boundary', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T06:30:00.000Z'));
    const data = aggregation(
      [{ bucket: '2026-09-30', sales: 25, orderCount: 1 }],
      'America/Mazatlan',
    );
    const result = await execute('thisMonth', data);
    expect(result.points.map((point) => point.label)).toEqual(['30']);
    expect(result.points[0]?.start).toBe('2026-09-30T07:00:00.000Z');
  });

  it('uses zero trend when the previous period has no sales', async () => {
    expect(calculateTrend(27, 0)).toBe(0);
    expect(calculateTrend(6365, 0)).toBe(0);
    expect(calculateTrend(200, 0)).toBe(0);

    const data = aggregation([{ bucket: '2026-09-29T12:00:00.000Z', sales: 6365, orderCount: 27 }]);
    data.previous = { total: 0, orderCount: 0 };
    const result = await execute('today', data);
    expect(result).toMatchObject({
      total: 6365,
      ordersCount: 27,
      trend: 0,
    });
  });

  it('calculates percentage trends without capping growth', () => {
    expect(calculateTrend(200, 100)).toBe(100);
    expect(calculateTrend(150, 100)).toBe(50);
    expect(calculateTrend(300, 100)).toBe(200);
    expect(calculateTrend(1000, 100)).toBe(900);
    expect(calculateTrend(75, 100)).toBe(-25);
  });

  it('returns aligned current and previous series with tooltip comparison data', async () => {
    const data = aggregation([
      { bucket: '2026-09-29', sales: 300, orderCount: 3 },
      { bucket: '2026-09-30', sales: 0, orderCount: 0 },
    ]);
    data.current = { total: 300, orderCount: 3 };
    data.previous = { total: 100, orderCount: 1 };
    data.previousBuckets = [
      { bucket: '2026-09-22', sales: 100, orderCount: 1 },
      { bucket: '2026-09-23', sales: 0, orderCount: 0 },
    ];

    const result = await execute('7d', data);

    expect(result.series.current).toHaveLength(2);
    expect(result.series.previous).toHaveLength(2);
    expect(result.series.current[0]).toMatchObject({ sales: 300, orderCount: 3 });
    expect(result.series.previous[0]).toMatchObject({ sales: 100, orderCount: 1 });
    expect(result.comparison).toEqual({
      current_total: 300,
      previous_total: 100,
      difference: 200,
      percentage_change: 200,
      status: 'OK',
    });
    expect(result.tooltip[0]).toMatchObject({
      current_sales: 300,
      previous_sales: 100,
      difference: 200,
      percentage_change: 200,
      current_orders_count: 3,
      previous_orders_count: 1,
      status: 'OK',
    });
  });

  it('returns NO_BASELINE for a positive current total with an empty previous period', async () => {
    const data = aggregation([{ bucket: '2026-09-29', sales: 300, orderCount: 3 }]);
    data.current = { total: 300, orderCount: 3 };
    data.previous = { total: 0, orderCount: 0 };
    data.previousBuckets = [{ bucket: '2026-09-22', sales: 0, orderCount: 0 }];

    const result = await execute('7d', data);

    expect(result.comparison).toMatchObject({
      difference: 300,
      percentage_change: null,
      status: 'NO_BASELINE',
    });
    expect(result.tooltip[0]).toMatchObject({ percentage_change: null, status: 'NO_BASELINE' });
  });

  it('handles zero-safe trend states and declines', async () => {
    expect(calculateTrend(0, 100)).toBe(-100);

    const data = aggregation([]);
    data.previous = { total: 0, orderCount: 0 };
    const result = await execute('today', data);
    expect(result.trend).toBe(0);
    expect(result.averageTicket).toBe(0);
  });
});
