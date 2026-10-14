import { describe, expect, it } from 'vitest';
import { GetAverageTicket } from './GetAverageTicket.js';
import type { AverageTicketRepository } from '../ports/AverageTicketRepository.js';

class FakeRepository implements AverageTicketRepository {
  lastRanges?: Parameters<AverageTicketRepository['aggregate']>[1];

  constructor(
    private readonly current: { totalSales: string; ordersCount: number },
    private readonly previous: { totalSales: string; ordersCount: number },
  ) {}

  async getBusiness() {
    return { businessId: 'business-1', currency: 'MXN', timezone: 'America/Mazatlan' };
  }

  async aggregate(
    _businessId: string,
    ranges: Parameters<AverageTicketRepository['aggregate']>[1],
  ) {
    this.lastRanges = ranges;
    return {
      current: this.current,
      previous: this.previous,
      global: { totalSales: '50000.00', ordersCount: 500 },
    };
  }
}

describe('GetAverageTicket', () => {
  const now = new Date('2026-03-31T23:30:00.000Z'); // 16:30 in America/Mazatlan

  it('calculates exact monetary averages, difference and percentage', async () => {
    const result = await new GetAverageTicket(
      new FakeRepository(
        { totalSales: '12500.00', ordersCount: 125 },
        { totalSales: '11000.00', ordersCount: 125 },
      ),
    ).execute('user-1', 'today', now);

    expect(result.current.average_ticket).toBe('100.00');
    expect(result.previous.average_ticket).toBe('88.00');
    expect(result.global.average_ticket).toBe('100.00');
    expect(JSON.stringify(result)).not.toContain('_cents');
    expect(result.comparison).toEqual({
      difference: '12.00',
      percentage_change: 13.64,
      direction: 'up',
      has_previous_data: true,
    });
    expect(result.current.start_at).toBe('2026-03-31T00:00:00.000-07:00');
    expect(result.previous.end_at).toBe('2026-03-31T00:00:00.000-07:00');
  });

  it('uses consecutive windows and clamps the previous month at its last day', async () => {
    const repository = new FakeRepository(
      { totalSales: '1.00', ordersCount: 1 },
      { totalSales: '1.00', ordersCount: 1 },
    );
    const result = await new GetAverageTicket(repository).execute('user-1', 'this_month', now);
    expect(result.current.start_at).toBe('2026-03-01T00:00:00.000-07:00');
    expect(result.previous.start_at).toBe('2026-02-01T00:00:00.000-07:00');
    expect(result.previous.end_at).toBe('2026-03-01T00:00:00.000-07:00');
  });

  it.each(['7d', '30d'] as const)(
    'uses complete calendar windows for the previous %s period',
    async (period) => {
      const repository = new FakeRepository(
        { totalSales: '100.00', ordersCount: 1 },
        { totalSales: '100.00', ordersCount: 1 },
      );
      await new GetAverageTicket(repository).execute('user-1', period, now);
      expect(repository.lastRanges?.current.start.toISOString()).toBe(
        period === '7d' ? '2026-03-25T07:00:00.000Z' : '2026-03-02T07:00:00.000Z',
      );
      expect(repository.lastRanges?.previous.start.toISOString()).toBe(
        period === '7d' ? '2026-03-18T07:00:00.000Z' : '2026-01-31T07:00:00.000Z',
      );
      expect(repository.lastRanges?.previous.end.toISOString()).toBe(
        period === '7d' ? '2026-03-25T07:00:00.000Z' : '2026-03-02T07:00:00.000Z',
      );
    },
  );

  it('compares an empty previous period using zero', async () => {
    const result = await new GetAverageTicket(
      new FakeRepository(
        { totalSales: '900.00', ordersCount: 3 },
        { totalSales: '0.00', ordersCount: 0 },
      ),
    ).execute('user-1', 'today', now);

    expect(result.current.average_ticket).toBe('300.00');
    expect(result.previous.average_ticket).toBe('0.00');
    expect(result.comparison).toEqual({
      difference: '300.00',
      percentage_change: 300,
      direction: 'up',
      has_previous_data: false,
    });
  });

  it('compares an empty current period as zero', async () => {
    const result = await new GetAverageTicket(
      new FakeRepository(
        { totalSales: '0.00', ordersCount: 0 },
        { totalSales: '600.00', ordersCount: 2 },
      ),
    ).execute('user-1', 'today', now);

    expect(result.comparison).toEqual({
      difference: '-300.00',
      percentage_change: -100,
      direction: 'down',
      has_previous_data: true,
    });
  });

  it('reports down and flat directions using unrounded averages', async () => {
    const down = await new GetAverageTicket(
      new FakeRepository(
        { totalSales: '100.00', ordersCount: 3 },
        { totalSales: '100.00', ordersCount: 2 },
      ),
    ).execute('user-1', 'today', now);
    expect(down.comparison.direction).toBe('down');

    const unchanged = await new GetAverageTicket(
      new FakeRepository(
        { totalSales: '100.00', ordersCount: 3 },
        { totalSales: '100.00', ordersCount: 3 },
      ),
    ).execute('user-1', 'today', now);
    expect(unchanged.comparison).toMatchObject({
      difference: '0.00',
      percentage_change: 0,
      direction: 'flat',
    });
  });

  it('returns zero values when both periods are empty', async () => {
    const result = await new GetAverageTicket(
      new FakeRepository(
        { totalSales: '0.00', ordersCount: 0 },
        { totalSales: '0.00', ordersCount: 0 },
      ),
    ).execute('user-1', 'today', now);
    expect(result.current).toMatchObject({
      total_sales: '0.00',
      orders_count: 0,
      average_ticket: '0.00',
    });
    expect(result.previous.average_ticket).toBe('0.00');
    expect(result.comparison).toMatchObject({
      difference: '0.00',
      percentage_change: 0,
      direction: 'flat',
      has_previous_data: false,
    });
  });

  it('supports one previous order, many current orders, and percentage rounding', async () => {
    const result = await new GetAverageTicket(
      new FakeRepository(
        { totalSales: '1000.00', ordersCount: 7 },
        { totalSales: '100.00', ordersCount: 1 },
      ),
    ).execute('user-1', '30d', now);

    expect(result.current.average_ticket).toBe('142.86');
    expect(result.previous.average_ticket).toBe('100.00');
    expect(result.comparison).toMatchObject({
      difference: '42.86',
      percentage_change: 42.86,
      direction: 'up',
      has_previous_data: true,
    });
  });

  it.each(['today', '7d', '30d', 'this_month'] as const)(
    'calculates comparison for the supported period %s',
    async (period) => {
      const result = await new GetAverageTicket(
        new FakeRepository(
          { totalSales: '300.00', ordersCount: 1 },
          { totalSales: '100.00', ordersCount: 1 },
        ),
      ).execute('user-1', period, now);

      expect(result.comparison).toMatchObject({
        difference: '200.00',
        percentage_change: 200,
        direction: 'up',
      });
    },
  );
});
