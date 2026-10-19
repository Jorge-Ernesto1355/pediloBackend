import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/shared/errors/app-error.js';
import { GetPublicStoreVisitStats } from './GetPublicStoreVisitStats.js';
import type { StoreVisitRepository } from '../ports/StoreVisitRepository.js';

function repository(): StoreVisitRepository {
  return {
    recordVisit: vi.fn(),
    getBusinessForStats: vi.fn().mockResolvedValue({
      id: 'business-1',
      timezone: 'America/Mazatlan',
    }),
    getStats: vi.fn().mockResolvedValue({
      current: { visits: 12, uniqueVisitors: 9 },
      previous: { visits: 8, uniqueVisitors: 7 },
      currentSeries: [{ bucket: '2026-10-16', visits: 12 }],
      previousSeries: [{ bucket: '2026-10-15', visits: 8 }],
    }),
  };
}

describe('GetPublicStoreVisitStats', () => {
  const now = new Date('2026-10-16T18:00:00.000Z');

  it('requires a business owned by the authenticated user', async () => {
    const repo = repository();
    vi.mocked(repo.getBusinessForStats).mockResolvedValue(null);
    await expect(
      new GetPublicStoreVisitStats(repo).execute('outsider', 'today', now),
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'BUSINESS_ACCESS_DENIED',
    } satisfies Partial<AppError>);
    expect(repo.getStats).not.toHaveBeenCalled();
  });

  it.each(['today', '7d', '30d', 'thisMonth'] as const)(
    'resolves %s in business local time and includes zero-filled current and previous series',
    async (period) => {
      const repo = repository();
      const isHourly = period === 'today';
      vi.mocked(repo.getStats).mockResolvedValue({
        current: { visits: 12, uniqueVisitors: 9 },
        previous: { visits: 8, uniqueVisitors: 7 },
        currentSeries: [{ bucket: isHourly ? '10' : '2026-10-16', visits: 12 }],
        previousSeries: [{ bucket: isHourly ? '10' : '2026-10-15', visits: 8 }],
      });
      const result = await new GetPublicStoreVisitStats(repo).execute('owner', period, now);
      const [businessId, ranges, timezone] = vi.mocked(repo.getStats).mock.calls[0]!;
      expect(businessId).toBe('business-1');
      expect(timezone).toBe('America/Mazatlan');
      expect(ranges.current.start.toISOString()).toBe(
        period === 'today'
          ? '2026-10-16T07:00:00.000Z'
          : period === '7d'
            ? '2026-10-10T07:00:00.000Z'
            : period === '30d'
              ? '2026-09-17T07:00:00.000Z'
              : '2026-10-01T07:00:00.000Z',
      );
      expect(ranges.current.end).toEqual(now);
      expect(ranges.previous.start.toISOString()).toBe(
        period === 'today'
          ? '2026-10-15T07:00:00.000Z'
          : period === '7d'
            ? '2026-10-03T07:00:00.000Z'
            : period === '30d'
              ? '2026-08-18T07:00:00.000Z'
              : '2026-09-01T07:00:00.000Z',
      );
      expect(ranges.previous.end.toISOString()).toBe(
        period === 'today'
          ? '2026-10-15T18:00:00.000Z'
          : period === '7d'
            ? '2026-10-09T18:00:00.000Z'
            : '2026-09-16T18:00:00.000Z',
      );
      expect(result.total_visits).toBe(12);
      expect(result.unique_visitors_estimated).toBe(9);
      expect(result.previous_period.total_visits).toBe(8);
      expect(result.comparison).toEqual({
        percentage_change: 50,
        direction: 'up',
        has_previous_data: true,
      });
      const expectedLength =
        period === 'today' ? 24 : period === '7d' ? 7 : period === '30d' ? 30 : 16;
      expect(result.series.granularity).toBe(isHourly ? 'hour' : 'day');
      expect(result.series.current).toHaveLength(expectedLength);
      expect(result.series.previous).toHaveLength(expectedLength);
      if (isHourly) {
        expect(result.series.current[0]).toEqual({ label: '00:00', visits: 0 });
        expect(result.series.current[10]).toEqual({ label: '10:00', visits: 12 });
        expect(result.series.current[23]).toEqual({ label: '23:00', visits: 0 });
        expect(result.series.previous[10]).toEqual({ label: '10:00', visits: 8 });
        expect(result.series.previous[23]).toEqual({ label: '23:00', visits: 0 });
      } else {
        expect(result.series.current.at(-1)).toEqual({ label: '2026-10-16', visits: 12 });
        expect(result.series.previous.every(({ visits }) => visits === 0)).toBe(true);
      }
    },
  );

  it('returns no percentage when the previous period has no visits', async () => {
    const repo = repository();
    vi.mocked(repo.getStats).mockResolvedValue({
      current: { visits: 0, uniqueVisitors: 0 },
      previous: { visits: 0, uniqueVisitors: 0 },
      currentSeries: [],
      previousSeries: [],
    });
    const result = await new GetPublicStoreVisitStats(repo).execute('owner', 'today', now);
    expect(result.total_visits).toBe(0);
    expect(result.unique_visitors_estimated).toBe(0);
    expect(result.comparison).toEqual({
      percentage_change: null,
      direction: 'unavailable',
      has_previous_data: false,
    });
    expect(result.series.current).toHaveLength(24);
    expect(result.series.current.every(({ visits }) => visits === 0)).toBe(true);
    expect(result.series.previous).toHaveLength(24);
    expect(result.series.previous.every(({ visits }) => visits === 0)).toBe(true);
  });
});
