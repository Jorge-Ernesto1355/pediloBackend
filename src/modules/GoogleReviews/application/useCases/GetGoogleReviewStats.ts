import { AppError } from '@/shared/errors/app-error.js';
import {
  addDays,
  addMonths,
  daysInMonth,
  localDate,
  zonedStart,
} from '@/shared/time/business-period.js';
import type { GoogleReviewRepository } from '../../domain/ports/GoogleReviewRepository.js';

export type GoogleReviewStatsPeriod = 'today' | '7d' | '30d' | 'thisMonth';

export class GetGoogleReviewStats {
  constructor(private readonly repository: GoogleReviewRepository) {}

  async execute(userId: string, period: GoogleReviewStatsPeriod, now = new Date()) {
    const business = await this.repository.getBusinessForStats(userId);
    if (!business)
      throw new AppError('Business not found or access denied', 403, 'BUSINESS_ACCESS_DENIED');

    const { current, previous } = resolveRanges(period, business.timezone, now);
    const stats = await this.repository.getStats(
      business.id,
      { current, previous },
      business.timezone,
    );
    const daily = fillDailySeries(period, business.timezone, now, stats.daily);
    const hasPreviousData = stats.previous.scans > 0;
    const comparisonPercentage = hasPreviousData
      ? Number(
          (((stats.current.scans - stats.previous.scans) / stats.previous.scans) * 100).toFixed(2),
        )
      : stats.current.scans > 0
        ? null
        : 0;

    return {
      period,
      total_scans: stats.current.scans,
      unique_visitors_estimated: stats.current.uniqueVisitors,
      comparison_percentage: comparisonPercentage,
      comparison_has_previous_data: hasPreviousData,
      previous_period_scans: stats.previous.scans,
      daily,
      meta: { timezone: business.timezone, generated_at: now.toISOString() },
    };
  }
}

function resolveRanges(period: GoogleReviewStatsPeriod, timezone: string, now: Date) {
  const today = localDate(now, timezone);
  const currentStart = zonedStart(
    period === 'today'
      ? today
      : period === 'thisMonth'
        ? { ...today, day: 1 }
        : addDays(today, period === '7d' ? -6 : -29),
    timezone,
  );
  const current = { start: currentStart, end: now };
  let previousStart: Date;
  let previousEnd = currentStart;

  if (period === 'today') previousStart = zonedStart(addDays(today, -1), timezone);
  else if (period === '7d' || period === '30d') {
    previousStart = zonedStart(addDays(today, period === '7d' ? -13 : -59), timezone);
  } else {
    const monthStart = { year: today.year, month: today.month, day: 1 };
    const priorMonth = addMonths(monthStart, -1);
    const priorMonthDays = daysInMonth(priorMonth.year, priorMonth.month);
    previousStart = zonedStart(priorMonth, timezone);
    const previousComparableDay = zonedStart(
      addDays(priorMonth, Math.min(today.day - 1, priorMonthDays)),
      timezone,
    );
    previousEnd = new Date(
      previousComparableDay.getTime() + now.getTime() - zonedStart(today, timezone).getTime(),
    );
  }

  return { current, previous: { start: previousStart, end: previousEnd } };
}

function fillDailySeries(
  period: GoogleReviewStatsPeriod,
  timezone: string,
  now: Date,
  rows: Array<{ date: string; scans: number }>,
) {
  const today = localDate(now, timezone);
  const start =
    period === 'today'
      ? today
      : period === 'thisMonth'
        ? { ...today, day: 1 }
        : addDays(today, period === '7d' ? -6 : -29);
  const counts = new Map(rows.map((row) => [row.date, row.scans]));
  const result: Array<{ date: string; scans: number }> = [];
  for (let offset = 0; offset <= daysBetween(start, today); offset += 1) {
    const day = addDays(start, offset);
    const date = `${day.year}-${String(day.month).padStart(2, '0')}-${String(day.day).padStart(2, '0')}`;
    result.push({ date, scans: counts.get(date) ?? 0 });
  }
  return result;
}

function daysBetween(
  start: { year: number; month: number; day: number },
  end: { year: number; month: number; day: number },
): number {
  return (
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
    86_400_000
  );
}
