import type { SalesPeriod, SalesRepository } from '../ports/SalesRepository.js';

export interface SalesDashboard {
  period: SalesPeriod;
  timezone: string;
  total: number;
  ordersCount: number;
  historicalSales: number;
  historicalOrderCount: number;
}

export class GetSalesDashboard {
  constructor(private readonly repository: SalesRepository) {}

  async execute(ownerUserId: string, period: SalesPeriod): Promise<SalesDashboard> {
    const aggregation = await this.repository.aggregate(ownerUserId, period);

    return {
      period,
      timezone: aggregation.timezone,
      total: roundMoney(aggregation.current.total),
      ordersCount: aggregation.current.orderCount,
      historicalSales: roundMoney(aggregation.historical.total),
      historicalOrderCount: aggregation.historical.orderCount,
    };
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
