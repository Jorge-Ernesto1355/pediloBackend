import type { SalesPeriod, SalesTotals } from './SalesRepository.js';

export interface TrendBucket {
  bucket: string;
  sales: number;
  orderCount: number;
}

export interface TrendAggregation {
  current: SalesTotals;
  previous: SalesTotals;
  buckets: TrendBucket[];
  previousBuckets: TrendBucket[];
  timezone: string;
}

export interface TrendRepository {
  aggregate(ownerUserId: string, period: SalesPeriod): Promise<TrendAggregation>;
}
