import { describe, expect, it } from 'vitest';
import { GetSalesDashboard } from './GetSalesDashboard.js';
import type { SalesAggregation, SalesPeriod, SalesRepository } from '../ports/SalesRepository.js';

class FakeSalesRepository implements SalesRepository {
  constructor(private readonly result: SalesAggregation) {}

  async aggregate(): Promise<SalesAggregation> {
    return this.result;
  }
}

function execute(period: SalesPeriod, result: SalesAggregation) {
  return new GetSalesDashboard(new FakeSalesRepository(result)).execute('user-id', period);
}

describe('GetSalesDashboard sales contract', () => {
  it('returns only period and historical sales metrics', async () => {
    const result = await execute('30d', {
      current: { total: 125.456, orderCount: 2 },
      historical: { total: 9876.5, orderCount: 42 },
      timezone: 'America/Mazatlan',
    });

    expect(result).toEqual({
      period: '30d',
      timezone: 'America/Mazatlan',
      total: 125.46,
      ordersCount: 2,
      historicalSales: 9876.5,
      historicalOrderCount: 42,
    });
  });
});
