export type SalesPeriod = 'today' | '7d' | '30d' | 'thisMonth';

export interface SalesBucket {
  bucket: string;
  sales: number;
  orderCount: number;
}

export interface SalesTotals {
  total: number;
  orderCount: number;
}

export interface SalesAggregation {
  current: SalesTotals;
  previous: SalesTotals;
  buckets: SalesBucket[];
  timezone: string;
}

export interface SalesRepository {
  aggregate(
    ownerUserId: string,
    period: SalesPeriod,
    bucket: 'hour' | 'day',
  ): Promise<SalesAggregation>;
}
