import { PrismaClient } from '@prisma/client';
import { PasswordResetRepository } from '../../application/ports/PasswordResetRepository.js';

export class PrismaPasswordResetRepository implements PasswordResetRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async cleanup(): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({
      where: { OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }] },
    });
  }

  async hasCredential(userId: string): Promise<boolean> {
    const account = await this.prisma.account.findFirst({
      where: { userId, password: { not: null } },
      select: { id: true },
    });
    return account !== null;
  }

  async create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void> {
    await this.prisma.passwordResetToken.deleteMany({
      where: { userId: input.userId, usedAt: null },
    });
    await this.prisma.passwordResetToken.create({ data: input });
  }

  async resetPassword(input: {
    tokenHash: string;
    passwordHash: string;
    now: Date;
  }): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const resetToken = await transaction.passwordResetToken.findUnique({
        where: { tokenHash: input.tokenHash },
        select: { id: true, userId: true, expiresAt: true, usedAt: true },
      });

      if (!resetToken || resetToken.usedAt || resetToken.expiresAt <= input.now) return false;

      const consumed = await transaction.passwordResetToken.updateMany({
        where: {
          id: resetToken.id,
          usedAt: null,
          expiresAt: { gt: input.now },
        },
        data: { usedAt: input.now },
      });
      if (consumed.count !== 1) return false;

      const account = await transaction.account.findFirst({
        where: { userId: resetToken.userId, password: { not: null } },
        select: { id: true },
      });
      if (!account) return false;

      await transaction.account.update({
        where: { id: account.id },
        data: { password: input.passwordHash },
      });
      await transaction.session.deleteMany({ where: { userId: resetToken.userId } });
      await transaction.passwordResetToken.updateMany({
        where: { userId: resetToken.userId, usedAt: null },
        data: { usedAt: input.now },
      });
      return true;
    });
  }
}
