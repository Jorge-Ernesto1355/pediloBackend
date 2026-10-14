import {
  addDays,
  addMonths,
  daysInMonth,
  localDate,
  zonedStart,
} from '@/shared/time/business-period.js';
import type { AverageTicketPeriod, AverageTicketRange } from '../ports/AverageTicketRepository.js';

export interface ResolvedAverageTicketPeriods {
  current: AverageTicketRange;
  previous: AverageTicketRange;
}

export function resolveAverageTicketPeriods(
  period: AverageTicketPeriod,
  timezone: string,
  now: Date,
): ResolvedAverageTicketPeriods {
  const today = localDate(now, timezone);
  const currentStart = zonedStart(
    period === 'today'
      ? today
      : period === 'this_month'
        ? { ...today, day: 1 }
        : addDays(today, periodDays(period) * -1 + 1),
    timezone,
  );

  if (period === 'today') {
    return {
      current: { start: currentStart, end: now },
      previous: {
        start: zonedStart(addDays(today, -1), timezone),
        end: currentStart,
      },
    };
  }

  if (period === '7d' || period === '30d') {
    const previousStart = zonedStart(addDays(today, periodDays(period) * -2 + 1), timezone);
    return {
      current: { start: currentStart, end: now },
      previous: { start: previousStart, end: currentStart },
    };
  }

  const currentMonthStart = { year: today.year, month: today.month, day: 1 };
  const previousMonthStart = addMonths(currentMonthStart, -1);
  const previousEndDay = Math.min(
    today.day,
    daysInMonth(previousMonthStart.year, previousMonthStart.month),
  );
  return {
    current: { start: zonedStart(currentMonthStart, timezone), end: now },
    previous: {
      start: zonedStart(previousMonthStart, timezone),
      end: zonedStart(addDays(previousMonthStart, previousEndDay), timezone),
    },
  };
}

function periodDays(period: AverageTicketPeriod): 7 | 30 {
  return period === '30d' ? 30 : 7;
}

function timezoneOffset(instant: number, timezone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(instant));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return (
    Date.UTC(
      value('year'),
      value('month') - 1,
      value('day'),
      value('hour'),
      value('minute'),
      value('second'),
    ) - instant
  );
}

export function formatEffectiveDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '00';
  const offset = Math.round(timezoneOffset(date.getTime(), timezone) / 60000);
  const sign = offset >= 0 ? '+' : '-';
  const absolute = Math.abs(offset);
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}:${value('second')}.${String(date.getUTCMilliseconds()).padStart(3, '0')}${sign}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`;
}
