import { describe, expect, it } from 'vitest';
import { GetSalesDashboard } from './GetSalesDashboard.js';
import type { SalesRepository } from '../ports/SalesRepository.js';

class FakeSalesRepository implements SalesRepository {
  async aggregate(): Promise<{
    current: { total: number; orderCount: number };
    previous: { total: number; orderCount: number };
    buckets: { bucket: string; sales: number; orderCount: number }[];
    timezone: string;
  }> {
    return {
      current: { total: 300, orderCount: 3 },
      previous: { total: 200, orderCount: 2 },
      buckets: [
        { bucket: '0', sales: 10, orderCount: 1 },
        { bucket: '12', sales: 20, orderCount: 1 },
        { bucket: '2026-09-19', sales: 270, orderCount: 1 },
      ],
      timezone: 'America/Mazatlan',
    };
  }
}

describe('GetSalesDashboard', () => {
  it.each(['today', '7d', '30d', 'thisMonth'] as const)(
    'returns the standard sales contract for %s',
    async (period) => {
      const result = await new GetSalesDashboard(new FakeSalesRepository()).execute(
        'user-id',
        period,
      );

      expect(result.total).toBe(300);
      expect(result.ordersCount).toBe(3);
      expect(result.averageTicket).toBe(100);
      expect(result.trend).toBe(50);
      expect(result.points.length).toBeGreaterThan(0);
      expect(result.points.every((point) => typeof point.label === 'string')).toBe(true);
      expect(result.points.every((point) => typeof point.orderCount === 'number')).toBe(true);
    },
  );

  it('returns zero trend instead of infinity when the previous period has no sales', async () => {
    const repository: SalesRepository = {
      aggregate: async () => ({
        current: { total: 0, orderCount: 0 },
        previous: { total: 0, orderCount: 0 },
        buckets: [],
        timezone: 'America/Mazatlan',
      }),
    };

    const result = await new GetSalesDashboard(repository).execute('user-id', 'today');
    expect(result.trend).toBe(0);
    expect(result.averageTicket).toBe(0);
  });
});
