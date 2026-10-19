import { describe, expect, it, vi } from 'vitest';
import { GetGoogleReviewStats } from './GetGoogleReviewStats.js';
import { AppError } from '@/shared/errors/app-error.js';
import type { GoogleReviewRepository } from '../../domain/ports/GoogleReviewRepository.js';

function repository(): GoogleReviewRepository {
  return {
    isOwner: vi.fn(),
    getDetailsByOwnerUserId: vi.fn(),
    upsertByOwnerUserId: vi.fn(),
    getRedirectByQrCode: vi.fn(),
    recordScan: vi.fn(),
    getBusinessForStats: vi.fn().mockResolvedValue({
      id: 'business-1',
      timezone: 'America/Mazatlan',
    }),
    getStats: vi.fn().mockResolvedValue({
      current: { scans: 12, uniqueVisitors: 9 },
      previous: { scans: 6, uniqueVisitors: 5 },
      daily: [{ date: '2026-10-16', scans: 12 }],
    }),
  };
}

describe('GetGoogleReviewStats', () => {
  const now = new Date('2026-10-16T18:00:00.000Z');

  it('requires an owned business before querying data', async () => {
    const repo = repository();
    vi.mocked(repo.getBusinessForStats).mockResolvedValue(null);
    await expect(
      new GetGoogleReviewStats(repo).execute('outsider', 'today', now),
    ).rejects.toMatchObject({
      ...new AppError('Business not found or access denied', 403, 'BUSINESS_ACCESS_DENIED'),
    });
    expect(repo.getStats).not.toHaveBeenCalled();
  });

  it.each(['today', '7d', '30d', 'thisMonth'] as const)(
    'builds the requested %s dates and complete daily series',
    async (period) => {
      const repo = repository();
      const result = await new GetGoogleReviewStats(repo).execute('owner', period, now);
      const args = vi.mocked(repo.getStats).mock.calls[0]!;
      expect(args[0]).toBe('business-1');
      expect(args[2]).toBe('America/Mazatlan');
      expect(args[1].current.end).toEqual(now);
      expect(args[1].current.start.toISOString()).toBe(
        period === 'today'
          ? '2026-10-16T07:00:00.000Z'
          : period === '7d'
            ? '2026-10-10T07:00:00.000Z'
            : period === '30d'
              ? '2026-09-17T07:00:00.000Z'
              : '2026-10-01T07:00:00.000Z',
      );
      expect(args[1].previous.start.toISOString()).toBe(
        period === 'today'
          ? '2026-10-15T07:00:00.000Z'
          : period === '7d'
            ? '2026-10-03T07:00:00.000Z'
            : period === '30d'
              ? '2026-08-18T07:00:00.000Z'
              : '2026-09-01T07:00:00.000Z',
      );
      expect(args[1].previous.end.toISOString()).toBe(
        period === 'thisMonth' ? '2026-09-16T18:00:00.000Z' : args[1].current.start.toISOString(),
      );
      expect(result.total_scans).toBe(12);
      expect(result.unique_visitors_estimated).toBe(9);
      expect(result.comparison_percentage).toBe(100);
      expect(result.comparison_has_previous_data).toBe(true);
      expect(result.daily.at(-1)).toEqual({ date: '2026-10-16', scans: 12 });
      expect(result.daily.filter((day) => day.scans === 0)).toHaveLength(result.daily.length - 1);
      expect(result.daily).toHaveLength(
        period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : 16,
      );
    },
  );

  it('compares totals with the immediately preceding interval', async () => {
    const repo = repository();
    vi.mocked(repo.getStats).mockResolvedValue({
      current: { scans: 9, uniqueVisitors: 7 },
      previous: { scans: 12, uniqueVisitors: 11 },
      daily: [],
    });
    const result = await new GetGoogleReviewStats(repo).execute('owner', 'today', now);
    expect(result.comparison_percentage).toBe(-25);
    expect(result.comparison_has_previous_data).toBe(true);
  });

  it('returns a null percentage when scans have no previous baseline', async () => {
    const repo = repository();
    vi.mocked(repo.getStats).mockResolvedValue({
      current: { scans: 4, uniqueVisitors: 4 },
      previous: { scans: 0, uniqueVisitors: 0 },
      daily: [],
    });
    const result = await new GetGoogleReviewStats(repo).execute('owner', 'today', now);
    expect(result.comparison_percentage).toBeNull();
    expect(result.comparison_has_previous_data).toBe(false);
  });
});
