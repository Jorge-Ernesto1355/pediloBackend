export interface StoreVisitRange {
  start: Date;
  end: Date;
}

export interface StoreVisitEvent {
  businessId: string;
  visitedAt: Date;
  visitorHash: string;
  dedupeBucket: Date;
}

export interface StoreVisitStatsRepositoryResult {
  current: { visits: number; uniqueVisitors: number };
  previous: { visits: number; uniqueVisitors: number };
  currentSeries: Array<{ bucket: string; visits: number }>;
  previousSeries: Array<{ bucket: string; visits: number }>;
}

export interface StoreVisitRepository {
  recordVisit(event: StoreVisitEvent): Promise<boolean>;
  getBusinessForStats(userId: string): Promise<{ id: string; timezone: string } | null>;
  getStats(
    businessId: string,
    ranges: { current: StoreVisitRange; previous: StoreVisitRange },
    timezone: string,
    granularity: 'hour' | 'day',
  ): Promise<StoreVisitStatsRepositoryResult>;
}
