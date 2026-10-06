import { describe, expect, it } from 'vitest';
import { getBusinessPeriodRange } from './business-period.js';

describe('business period ranges', () => {
  it('uses business-local calendar boundaries for today, 7d, and 30d', () => {
    const now = new Date('2026-10-05T12:00:00.000Z');

    expect(getBusinessPeriodRange('today', 'America/Mazatlan', now)).toEqual({
      start: new Date('2026-10-05T07:00:00.000Z'),
      end: new Date('2026-10-06T07:00:00.000Z'),
    });
    expect(getBusinessPeriodRange('7d', 'America/Mazatlan', now)).toEqual({
      start: new Date('2026-09-29T07:00:00.000Z'),
      end: new Date('2026-10-06T07:00:00.000Z'),
    });
    expect(getBusinessPeriodRange('30d', 'America/Mazatlan', now)).toEqual({
      start: new Date('2026-09-06T07:00:00.000Z'),
      end: new Date('2026-10-06T07:00:00.000Z'),
    });
  });

  it('returns the complete previous calendar month across year changes', () => {
    expect(
      getBusinessPeriodRange('lastMonth', 'UTC', new Date('2026-01-15T12:00:00.000Z')),
    ).toEqual({
      start: new Date('2025-12-01T00:00:00.000Z'),
      end: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(
      getBusinessPeriodRange('lastMonth', 'UTC', new Date('2026-03-15T12:00:00.000Z')),
    ).toEqual({
      start: new Date('2026-02-01T00:00:00.000Z'),
      end: new Date('2026-03-01T00:00:00.000Z'),
    });
  });

  it('uses a half-open range so boundary orders are deterministic', () => {
    const range = getBusinessPeriodRange(
      'lastMonth',
      'America/Mazatlan',
      new Date('2026-10-05T12:00:00.000Z'),
    );

    expect(new Date('2026-09-01T07:00:00.000Z') >= range.start).toBe(true);
    expect(new Date('2026-10-01T07:00:00.000Z') >= range.end).toBe(true);
    expect(new Date('2026-09-01T06:59:59.999Z') < range.start).toBe(true);
  });

  it('handles leap-year February and the business-local day before UTC midnight', () => {
    expect(
      getBusinessPeriodRange('lastMonth', 'UTC', new Date('2028-03-15T12:00:00.000Z')),
    ).toEqual({
      start: new Date('2028-02-01T00:00:00.000Z'),
      end: new Date('2028-03-01T00:00:00.000Z'),
    });
    expect(
      getBusinessPeriodRange('today', 'America/Mazatlan', new Date('2026-10-05T06:59:59.999Z')),
    ).toEqual({
      start: new Date('2026-10-04T07:00:00.000Z'),
      end: new Date('2026-10-05T07:00:00.000Z'),
    });
  });
});
