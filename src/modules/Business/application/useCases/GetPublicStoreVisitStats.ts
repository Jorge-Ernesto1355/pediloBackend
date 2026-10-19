import { AppError } from '@/shared/errors/app-error.js';
import {
  addDays,
  addMonths,
  daysInMonth,
  localDate,
  zonedStart,
} from '@/shared/time/business-period.js';
import type { StoreVisitRepository, StoreVisitRange } from '../ports/StoreVisitRepository.js';

export type StoreVisitPeriod = 'today' | '7d' | '30d' | 'thisMonth';

export class GetPublicStoreVisitStats {
  constructor(private readonly repository: StoreVisitRepository) {}

  async execute(userId: string, period: StoreVisitPeriod, now = new Date()) {
    const business = await this.repository.getBusinessForStats(userId);
    if (!business) {
      throw new AppError('Business not found or access denied', 403, 'BUSINESS_ACCESS_DENIED');
    }

    const periods = resolvePeriods(period, business.timezone, now);
    const granularity = period === 'today' ? 'hour' : 'day';
    const totals = await this.repository.getStats(
      business.id,
      periods,
      business.timezone,
      granularity,
    );
    const hasPreviousData = totals.previous.visits > 0;
    const percentageChange = hasPreviousData
      ? Number(
          (
            ((totals.current.visits - totals.previous.visits) / totals.previous.visits) *
            100
          ).toFixed(2),
        )
      : null;

    return {
      period,
      total_visits: totals.current.visits,
      unique_visitors_estimated: totals.current.uniqueVisitors,
      previous_period: {
        total_visits: totals.previous.visits,
        unique_visitors_estimated: totals.previous.uniqueVisitors,
      },
      comparison: {
        percentage_change: percentageChange,
        direction:
          percentageChange === null
            ? 'unavailable'
            : percentageChange > 0
              ? 'up'
              : percentageChange < 0
                ? 'down'
                : 'flat',
        has_previous_data: hasPreviousData,
      },
      series: {
        granularity,
        current:
          granularity === 'hour'
            ? fillHourlySeries(totals.currentSeries)
            : fillDailySeries(
                periods.currentDates.start,
                periods.currentDates.end,
                totals.currentSeries,
              ),
        previous:
          granularity === 'hour'
            ? fillHourlySeries(totals.previousSeries)
            : fillDailySeries(
                periods.previousDates.start,
                periods.previousDates.end,
                totals.previousSeries,
              ),
      },
      meta: {
        timezone: business.timezone,
        generated_at: now.toISOString(),
        current_range: {
          start_at: periods.current.start.toISOString(),
          end_at: periods.current.end.toISOString(),
        },
        previous_range: {
          start_at: periods.previous.start.toISOString(),
          end_at: periods.previous.end.toISOString(),
        },
      },
    };
  }
}

interface ResolvedStoreVisitPeriods {
  current: StoreVisitRange;
  previous: StoreVisitRange;
  currentDates: { start: ReturnType<typeof localDate>; end: ReturnType<typeof localDate> };
  previousDates: { start: ReturnType<typeof localDate>; end: ReturnType<typeof localDate> };
}

function resolvePeriods(
  period: StoreVisitPeriod,
  timezone: string,
  now: Date,
): ResolvedStoreVisitPeriods {
  const today = localDate(now, timezone);
  const currentDays =
    period === 'today' ? 1 : period === '7d' ? 7 : period === '30d' ? 30 : today.day;
  const currentStartDate =
    period === 'thisMonth' ? { ...today, day: 1 } : addDays(today, -(currentDays - 1));
  const currentStart = zonedStart(currentStartDate, timezone);
  const current = { start: currentStart, end: now };

  let previousStartDate: ReturnType<typeof localDate>;
  let previousEndDate: ReturnType<typeof localDate>;
  if (period === 'thisMonth') {
    const currentMonthStart = { year: today.year, month: today.month, day: 1 };
    const previousMonthStart = addMonths(currentMonthStart, -1);
    const lastPreviousMonthDay = daysInMonth(previousMonthStart.year, previousMonthStart.month);
    previousStartDate = previousMonthStart;
    previousEndDate = addDays(previousMonthStart, Math.min(today.day - 1, lastPreviousMonthDay));
  } else {
    previousStartDate = addDays(today, -(currentDays * 2 - 1));
    previousEndDate = addDays(today, -currentDays);
  }

  const previousStart = zonedStart(previousStartDate, timezone);
  const previousComparableDayStart = zonedStart(previousEndDate, timezone);
  const elapsedToday = now.getTime() - zonedStart(today, timezone).getTime();
  const previous = {
    start: previousStart,
    end: new Date(previousComparableDayStart.getTime() + elapsedToday),
  };

  return {
    current,
    previous,
    currentDates: { start: currentStartDate, end: today },
    previousDates: { start: previousStartDate, end: previousEndDate },
  };
}

function fillDailySeries(
  start: ReturnType<typeof localDate>,
  end: ReturnType<typeof localDate>,
  rows: Array<{ bucket: string; visits: number }>,
) {
  const counts = new Map(rows.map(({ bucket, visits }) => [bucket, visits]));
  const totalDays =
    (Date.UTC(end.year, end.month - 1, end.day) -
      Date.UTC(start.year, start.month - 1, start.day)) /
    86_400_000;
  return Array.from({ length: totalDays + 1 }, (_, offset) => {
    const dateParts = addDays(start, offset);
    const date = `${dateParts.year}-${String(dateParts.month).padStart(2, '0')}-${String(dateParts.day).padStart(2, '0')}`;
    return { label: date, visits: counts.get(date) ?? 0 };
  });
}

function fillHourlySeries(rows: Array<{ bucket: string; visits: number }>) {
  const counts = new Map(rows.map(({ bucket, visits }) => [Number(bucket), visits]));
  return Array.from({ length: 24 }, (_, hour) => ({
    label: `${String(hour).padStart(2, '0')}:00`,
    visits: counts.get(hour) ?? 0,
  }));
}
