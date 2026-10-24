import { describe, expect, it } from 'vitest';
import { GetHistoricalSales } from './GetHistoricalSales.js';

describe('GetHistoricalSales', () => {
  it('returns only historical sales totals', async () => {
    const service = new GetHistoricalSales({
      aggregate: async () => ({ total: 3232.456, orderCount: 4 }),
    });

    await expect(service.execute('owner-id')).resolves.toEqual({
      historicalSales: 3232.46,
      historicalOrderCount: 4,
    });
  });
});
