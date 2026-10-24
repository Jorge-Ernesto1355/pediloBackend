import type { HistoricalSalesRepository } from '../ports/HistoricalSalesRepository.js';

export interface HistoricalSalesResponse {
  historicalSales: number;
  historicalOrderCount: number;
}

export class GetHistoricalSales {
  constructor(private readonly repository: HistoricalSalesRepository) {}

  async execute(ownerUserId: string): Promise<HistoricalSalesResponse> {
    const totals = await this.repository.aggregate(ownerUserId);
    return {
      historicalSales: roundMoney(totals.total),
      historicalOrderCount: totals.orderCount,
    };
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
