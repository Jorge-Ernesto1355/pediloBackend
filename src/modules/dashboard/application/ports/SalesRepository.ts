export type SalesPeriod = 'today' | '7d' | '30d' | 'thisMonth';

export interface SalesTotals {
  total: number;
  orderCount: number;
}

export interface SalesAggregation {
  current: SalesTotals;
  historical: SalesTotals;
  timezone: string;
}

export interface SalesRepository {
  aggregate(ownerUserId: string, period: SalesPeriod): Promise<SalesAggregation>;
}
