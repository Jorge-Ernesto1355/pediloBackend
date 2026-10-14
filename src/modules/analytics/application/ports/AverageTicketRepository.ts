export type AverageTicketPeriod = 'today' | '7d' | '30d' | 'this_month';

export interface AverageTicketRange {
  start: Date;
  end: Date;
}

export interface AverageTicketBusiness {
  businessId: string;
  currency: string;
  timezone: string;
}

export interface AverageTicketTotals {
  totalSales: string;
  ordersCount: number;
}

export interface AverageTicketAggregation {
  current: AverageTicketTotals;
  previous: AverageTicketTotals;
  global: AverageTicketTotals;
}

export interface AverageTicketRepository {
  getBusiness(ownerUserId: string): Promise<AverageTicketBusiness>;
  aggregate(
    businessId: string,
    ranges: { current: AverageTicketRange; previous: AverageTicketRange },
  ): Promise<AverageTicketAggregation>;
}
