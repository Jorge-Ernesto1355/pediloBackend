import { describe, expect, it } from 'vitest';
import { storeVisitStatsQuerySchema } from './store-visit-stats.schemas.js';

describe('storeVisitStatsQuerySchema', () => {
  it('defaults to today and accepts supported periods', () => {
    expect(storeVisitStatsQuerySchema.parse({})).toEqual({ period: 'today' });
    for (const period of ['today', '7d', '30d', 'thisMonth']) {
      expect(storeVisitStatsQuerySchema.safeParse({ period }).success).toBe(true);
    }
  });

  it('rejects unsupported values', () => {
    expect(storeVisitStatsQuerySchema.safeParse({ period: 'lastMonth' }).success).toBe(false);
  });
});
