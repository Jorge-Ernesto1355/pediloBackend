import {
  addDays,
  addMonths,
  daysInMonth,
  getBusinessPeriodRange,
  localDate,
  zonedStart,
} from './business-period.js';

export type SalesPeriod = 'today' | '7d' | '30d' | 'thisMonth';

export interface SalesRange {
  start: Date;
  end: Date;
}

export function buildSalesRanges(
  period: SalesPeriod,
  timezone: string,
  now: Date,
): { current: SalesRange; previous: SalesRange } {
  const today = localDate(now, timezone);
  if (period === 'today') {
    return {
      current: getBusinessPeriodRange('today', timezone, now),
      previous: {
        start: zonedStart(addDays(today, -1), timezone),
        end: zonedStart(today, timezone),
      },
    };
  }
  if (period === '7d') {
    return {
      current: getBusinessPeriodRange('7d', timezone, now),
      previous: {
        start: zonedStart(addDays(today, -13), timezone),
        end: zonedStart(addDays(today, -6), timezone),
      },
    };
  }
  if (period === '30d') {
    return {
      current: getBusinessPeriodRange('30d', timezone, now),
      previous: {
        start: zonedStart(addDays(today, -59), timezone),
        end: zonedStart(addDays(today, -29), timezone),
      },
    };
  }
  const monthStart = { year: today.year, month: today.month, day: 1 };
  const previousMonth = addMonths(monthStart, -1);
  const previousEnd = addDays(
    previousMonth,
    Math.min(today.day, daysInMonth(previousMonth.year, previousMonth.month)),
  );
  return {
    current: getBusinessPeriodRange('thisMonth', timezone, now),
    previous: {
      start: zonedStart(previousMonth, timezone),
      end: zonedStart(previousEnd, timezone),
    },
  };
}
