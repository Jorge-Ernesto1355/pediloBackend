export type BusinessPeriod = 'today' | '7d' | '30d' | 'thisMonth' | 'lastMonth';

export interface DateParts {
  year: number;
  month: number;
  day: number;
}

export interface PeriodRange {
  start: Date;
  end: Date;
}

/** Returns a half-open UTC range for a calendar period in the business timezone. */
export function getBusinessPeriodRange(
  period: BusinessPeriod,
  timezone: string,
  now: Date,
): PeriodRange {
  const today = localDate(now, timezone);
  const tomorrow = addDays(today, 1);
  if (period === 'today')
    return { start: zonedStart(today, timezone), end: zonedStart(tomorrow, timezone) };
  if (period === '7d') {
    return { start: zonedStart(addDays(today, -6), timezone), end: zonedStart(tomorrow, timezone) };
  }
  if (period === '30d') {
    return {
      start: zonedStart(addDays(today, -29), timezone),
      end: zonedStart(tomorrow, timezone),
    };
  }

  const monthStart = { year: today.year, month: today.month, day: 1 };
  if (period === 'thisMonth') return { start: zonedStart(monthStart, timezone), end: now };

  const previousMonth = addMonths(monthStart, -1);
  return {
    start: zonedStart(previousMonth, timezone),
    end: zonedStart(monthStart, timezone),
  };
}

export function localDate(date: Date, timezone: string): DateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value ?? 0),
    month: Number(parts.find((part) => part.type === 'month')?.value ?? 0),
    day: Number(parts.find((part) => part.type === 'day')?.value ?? 0),
  };
}

export function zonedStart(parts: DateParts, timezone: string): Date {
  const localUtc = Date.UTC(parts.year, parts.month - 1, parts.day);
  let instant = localUtc;
  for (let index = 0; index < 3; index += 1) instant = localUtc - timezoneOffset(instant, timezone);
  return new Date(instant);
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

export function addDays(parts: DateParts, days: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: date.getUTCDate() };
}

export function addMonths(parts: DateParts, months: number): DateParts {
  const date = new Date(Date.UTC(parts.year, parts.month - 1 + months, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, day: 1 };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}
