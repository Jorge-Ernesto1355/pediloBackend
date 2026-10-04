import { OrderStatus, Prisma, PrismaClient } from '@prisma/client';
import { AccountProfile, AccountRepository } from '../../application/ports/AccountRepository.js';
import { EmailVerificationTokenRepository } from '../../application/ports/EmailVerificationTokenRepository.js';

const generatedOrderStatuses: OrderStatus[] = [
  OrderStatus.PREPARING,
  OrderStatus.READY,
];

export class PrismaAccountRepository implements AccountRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getProfile(userId: string): Promise<AccountProfile | null> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, emailVerified: true, createdAt: true, businessId: true },
    });
    if (!user) return null;

    const since = user.createdAt;
    const [customersCount, ordersCount, revenue] = user.businessId
      ? await this.prisma.$transaction([
          this.prisma.customer.count({
            where: { businessId: user.businessId, createdAt: { gte: since } },
          }),
          this.prisma.order.count({
            where: {
              businessId: user.businessId,
              createdAt: { gte: since },
              status: { in: generatedOrderStatuses },
            },
          }),
          this.prisma.order.aggregate({
            where: {
              businessId: user.businessId,
              createdAt: { gte: since },
              status: { in: generatedOrderStatuses },
            },
            _sum: { total: true },
          }),
        ])
      : [0, 0, { _sum: { total: null } }];

    return {
      name: user.name,
      email: user.email,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt,
      stats: {
        customersCount: Number(customersCount),
        ordersCount: Number(ordersCount),
        totalGenerated: toNumber(revenue._sum?.total),
      },
    };
  }

  async hasNameConflict(userId: string, name: string): Promise<boolean> {
    const user = await this.prisma.user.findFirst({
      where: { name, NOT: { id: userId } },
      select: { id: true },
    });
    return user !== null;
  }

  async updateName(userId: string, name: string): Promise<void> {
    await this.prisma.user.update({ where: { id: userId }, data: { name } });
  }

  async getEmailVerificationTarget(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true },
    });
  }

  async markEmailVerified(
    tokenHash: string,
    now: Date,
  ): Promise<'verified' | 'already-verified' | 'invalid'> {
    return this.prisma.$transaction(async (transaction) => {
      const token = await transaction.emailVerificationToken.findUnique({
        where: { tokenHash },
        select: {
          id: true,
          userId: true,
          expiresAt: true,
          usedAt: true,
          user: { select: { emailVerified: true } },
        },
      });
      if (!token || token.expiresAt <= now) return 'invalid';
      if (token.usedAt) return token.user.emailVerified ? 'already-verified' : 'invalid';

      const consumed = await transaction.emailVerificationToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now } },
        data: { usedAt: now },
      });
      if (consumed.count !== 1) return 'invalid';

      await transaction.user.update({ where: { id: token.userId }, data: { emailVerified: true } });
      await transaction.emailVerificationToken.updateMany({
        where: { userId: token.userId, usedAt: null },
        data: { usedAt: now },
      });
      return 'verified';
    });
  }
}

export class PrismaEmailVerificationTokenRepository implements EmailVerificationTokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async cleanup(): Promise<void> {
    await this.prisma.emailVerificationToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
    });
  }

  async create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.emailVerificationToken.deleteMany({
      where: { userId: input.userId, usedAt: null },
    });
    await this.prisma.emailVerificationToken.create({ data: input });
  }
}

function toNumber(value: Prisma.Decimal | null | undefined): number {
  return value?.toNumber() ?? 0;
}
