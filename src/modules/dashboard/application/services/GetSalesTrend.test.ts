import { describe, expect, it } from 'vitest';
import { calculateTrend, GetSalesTrend } from './GetSalesTrend.js';
import type { TrendRepository } from '../ports/TrendRepository.js';

describe('GetSalesTrend', () => {
  it('calculates the trend independently from the sales response', async () => {
    const repository: TrendRepository = {
      aggregate: async () => ({
        current: { total: 150, orderCount: 0 },
        previous: { total: 100, orderCount: 0 },
        buckets: [],
        previousBuckets: [],
        timezone: 'America/Mazatlan',
      }),
    };

    await expect(new GetSalesTrend(repository).execute('user-id', '7d')).resolves.toMatchObject({
      period: '7d',
      timezone: 'America/Mazatlan',
      trend: 50,
      points: [],
      series: { current: [], previous: [] },
      tooltip: [],
    });
  });

  it('keeps the existing zero-baseline rule', () => {
    expect(calculateTrend(100, 0)).toBe(0);
    expect(calculateTrend(0, 100)).toBe(-100);
  });
});
