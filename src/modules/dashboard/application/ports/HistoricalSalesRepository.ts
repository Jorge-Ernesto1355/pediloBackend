export interface HistoricalSalesTotals {
  total: number;
  orderCount: number;
}

export interface HistoricalSalesRepository {
  aggregate(ownerUserId: string): Promise<HistoricalSalesTotals>;
}
