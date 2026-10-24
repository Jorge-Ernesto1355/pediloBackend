import { Prisma, PrismaClient } from '@prisma/client';
import { AppError } from '@/shared/errors/app-error.js';
import type {
  HistoricalSalesRepository,
  HistoricalSalesTotals,
} from '../../application/ports/HistoricalSalesRepository.js';

interface HistoricalRow {
  total: Prisma.Decimal | number | null;
  orderCount: bigint | number;
}

const saleStatuses = Prisma.join(
  ['PREPARING', 'READY'].map((status) => Prisma.sql`${status}::"OrderStatus"`),
);

export class PrismaHistoricalSalesRepository implements HistoricalSalesRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async aggregate(ownerUserId: string): Promise<HistoricalSalesTotals> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new AppError('Business not found', 404, 'BUSINESS_NOT_FOUND');
    const now = new Date();

    const rows = await this.prisma.$queryRaw<HistoricalRow[]>(Prisma.sql`
      WITH historical_orders AS MATERIALIZED (
        SELECT DISTINCT ON (o."businessId", o."orderNumber")
          o."total", o."id"
        FROM "Order" o
        WHERE o."businessId" = ${user.businessId}
          AND o."status" IN (${saleStatuses})
          AND o."createdAt" < ${now}
        ORDER BY o."businessId", o."orderNumber", o."createdAt" DESC, o."id" DESC
      )
      SELECT
        COALESCE(SUM("total"), 0) AS "total",
        COUNT(*) AS "orderCount"
      FROM historical_orders
    `);
    const row = rows[0];
    return {
      total: toNumber(row?.total),
      orderCount: toNumber(row?.orderCount),
    };
  }
}

function toNumber(value: Prisma.Decimal | number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  return typeof value === 'bigint'
    ? Number(value)
    : value instanceof Prisma.Decimal
      ? value.toNumber()
      : Number(value);
}
