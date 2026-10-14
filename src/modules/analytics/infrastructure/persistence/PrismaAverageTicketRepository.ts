import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/shared/errors/app-error.js';
import type {
  AverageTicketRange,
  AverageTicketRepository,
} from '../../application/ports/AverageTicketRepository.js';

interface TotalsRow {
  currentTotal: Prisma.Decimal | number | null;
  currentCount: bigint | number;
  previousTotal: Prisma.Decimal | number | null;
  previousCount: bigint | number;
  globalTotal: Prisma.Decimal | number | null;
  globalCount: bigint | number;
}
const saleStatuses = Prisma.join(
  ['PREPARING', 'READY'].map((status) => Prisma.sql`${status}::"OrderStatus"`),
);

export class PrismaAverageTicketRepository implements AverageTicketRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getBusiness(ownerUserId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: {
        businessId: true,
        business: { select: { settings: { select: { currency: true, timezone: true } } } },
      },
    });
    if (!user?.businessId) throw new AppError('Business not found', 404, 'BUSINESS_NOT_FOUND');
    return {
      businessId: user.businessId,
      currency: user.business?.settings?.currency ?? 'MXN',
      timezone: user.business?.settings?.timezone ?? 'America/Mazatlan',
    };
  }

  async aggregate(
    businessId: string,
    ranges: { current: AverageTicketRange; previous: AverageTicketRange },
  ) {
    const rows = await this.prisma.$queryRaw<TotalsRow[]>(Prisma.sql`
      SELECT
        COALESCE(SUM(o."total") FILTER (WHERE o."createdAt" >= ${ranges.current.start} AND o."createdAt" < ${ranges.current.end}), 0) AS "currentTotal",
        COUNT(*) FILTER (WHERE o."createdAt" >= ${ranges.current.start} AND o."createdAt" < ${ranges.current.end}) AS "currentCount",
        COALESCE(SUM(o."total") FILTER (WHERE o."createdAt" >= ${ranges.previous.start} AND o."createdAt" < ${ranges.previous.end}), 0) AS "previousTotal",
        COUNT(*) FILTER (WHERE o."createdAt" >= ${ranges.previous.start} AND o."createdAt" < ${ranges.previous.end}) AS "previousCount",
        COALESCE(SUM(o."total"), 0) AS "globalTotal",
        COUNT(*) AS "globalCount"
      FROM "Order" o
      WHERE o."businessId" = ${businessId}
        AND o."status" IN (${saleStatuses})
    `);
    const row = rows[0];
    return {
      current: { totalSales: toMoney(row?.currentTotal), ordersCount: toCount(row?.currentCount) },
      previous: {
        totalSales: toMoney(row?.previousTotal),
        ordersCount: toCount(row?.previousCount),
      },
      global: {
        totalSales: toMoney(row?.globalTotal),
        ordersCount: toCount(row?.globalCount),
      },
    };
  }
}

function toMoney(value: Prisma.Decimal | number | null | undefined): string {
  if (value === null || value === undefined) return '0.00';
  return value instanceof Prisma.Decimal ? value.toFixed(2) : Number(value).toFixed(2);
}

function toCount(value: bigint | number | null | undefined): number {
  return value === null || value === undefined
    ? 0
    : typeof value === 'bigint'
      ? Number(value)
      : value;
}
