import type {
  AverageTicketPeriod,
  AverageTicketRepository,
} from '../ports/AverageTicketRepository.js';
import { formatEffectiveDate, resolveAverageTicketPeriods } from './average-ticket-periods.js';

export class GetAverageTicket {
  constructor(private readonly repository: AverageTicketRepository) {}

  async execute(ownerUserId: string, period: AverageTicketPeriod, now = new Date()) {
    const business = await this.repository.getBusiness(ownerUserId);
    const ranges = resolveAverageTicketPeriods(period, business.timezone, now);
    const totals = await this.repository.aggregate(business.businessId, ranges);
    const current = toMetric(totals.current);
    const previous = toMetric(totals.previous);
    const global = toMetric(totals.global);
    const comparison = compare(current, previous);

    return {
      metric: 'average_ticket' as const,
      period,
      currency: business.currency,
      current: {
        ...publicMetric(current),
        start_at: formatEffectiveDate(ranges.current.start, business.timezone),
        end_at: formatEffectiveDate(ranges.current.end, business.timezone),
      },
      previous: {
        ...publicMetric(previous),
        start_at: formatEffectiveDate(ranges.previous.start, business.timezone),
        end_at: formatEffectiveDate(ranges.previous.end, business.timezone),
      },
      global: publicMetric(global),
      comparison,
      meta: {
        timezone: business.timezone,
        generated_at: formatEffectiveDate(now, business.timezone),
      },
    };
  }
}

function publicMetric(metric: ReturnType<typeof toMetric>) {
  return {
    total_sales: metric.total_sales,
    orders_count: metric.orders_count,
    average_ticket: metric.average_ticket,
  };
}

function toMetric(totals: { totalSales: string; ordersCount: number }) {
  const cents = parseCents(totals.totalSales);
  return {
    total_sales: formatCents(cents),
    orders_count: totals.ordersCount,
    average_ticket:
      totals.ordersCount === 0 ? '0.00' : formatMoneyRational(cents, BigInt(totals.ordersCount), 2),
    _cents: cents,
    _count: BigInt(totals.ordersCount),
  };
}

function compare(current: ReturnType<typeof toMetric>, previous: ReturnType<typeof toMetric>) {
  const hasPreviousData = previous.orders_count > 0;
  const currentCount = current._count === 0n ? 1n : current._count;
  const previousCount = previous._count === 0n ? 1n : previous._count;
  const differenceNumerator = current._cents * previousCount - previous._cents * currentCount;
  const differenceDenominator = currentCount * previousCount;
  const direction = differenceNumerator > 0n ? 'up' : differenceNumerator < 0n ? 'down' : 'flat';
  const percentageChange =
    previous._cents > 0n
      ? Number(formatRational(differenceNumerator * 100n, currentCount * previous._cents, 2))
      : current._cents > 0n
        ? Number(formatMoneyRational(current._cents, currentCount, 2))
        : 0;

  return {
    difference: formatMoneyRational(differenceNumerator, differenceDenominator, 2),
    percentage_change: percentageChange,
    direction,
    has_previous_data: hasPreviousData,
  };
}

function parseCents(value: string): bigint {
  const normalized = value.trim().replace(/^\+/, '');
  const match = normalized.match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error(`Invalid monetary aggregate: ${value}`);
  const fraction = (match[3] ?? '').padEnd(2, '0');
  const whole = match[2];
  if (!whole) throw new Error(`Invalid monetary aggregate: ${value}`);
  const cents = BigInt(whole) * 100n + BigInt(fraction || '0');
  return match[1] === '-' ? -cents : cents;
}

function formatCents(cents: bigint): string {
  const sign = cents < 0n ? '-' : '';
  const absolute = cents < 0n ? -cents : cents;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

function formatRational(numerator: bigint, denominator: bigint, decimals: number): string {
  if (denominator === 0n) return '0.00';
  const scale = 10n ** BigInt(decimals);
  const sign = numerator < 0n ? '-' : '';
  const absolute = numerator < 0n ? -numerator : numerator;
  const rounded = (absolute * scale * 2n + denominator) / (2n * denominator);
  return `${sign}${rounded / scale}.${String(rounded % scale).padStart(decimals, '0')}`;
}

function formatMoneyRational(numerator: bigint, denominator: bigint, decimals: number): string {
  return formatRational(numerator, denominator * 100n, decimals);
}
