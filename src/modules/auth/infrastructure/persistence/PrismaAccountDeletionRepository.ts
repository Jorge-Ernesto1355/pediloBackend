import { PrismaClient } from '@prisma/client';
import {
  AccountDeletionAssets,
  AccountDeletionRepository,
} from '../../application/ports/AccountDeletionRepository.js';

export class PrismaAccountDeletionRepository implements AccountDeletionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async deleteByUserId(userId: string): Promise<AccountDeletionAssets> {
    return this.prisma.$transaction(async (transaction) => {
      const user = await transaction.user.findUnique({
        where: { id: userId },
        select: { businessId: true, email: true },
      });

      if (!user) {
        return { businessImagePublicIds: [], productImagePublicIds: [] };
      }

      const assets: AccountDeletionAssets = {
        businessImagePublicIds: [],
        productImagePublicIds: [],
      };

      if (user.businessId) {
        const [businessImages, productImages] = await Promise.all([
          transaction.businessImage.findMany({
            where: { businessId: user.businessId },
            select: { publicId: true },
          }),
          transaction.product.findMany({
            where: { businessId: user.businessId },
            select: { imagePublicId: true },
          }),
        ]);

        assets.businessImagePublicIds = businessImages.map((image) => image.publicId);
        assets.productImagePublicIds = productImages.flatMap((product) =>
          product.imagePublicId ? [product.imagePublicId] : [],
        );
      }

      // Remove Better Auth and application-owned records explicitly before the
      // business. This keeps the deletion independent of database cascade order.
      await transaction.session.deleteMany({ where: { userId } });
      await transaction.account.deleteMany({ where: { userId } });
      await transaction.passwordResetToken.deleteMany({ where: { userId } });
      await transaction.emailVerificationToken.deleteMany({ where: { userId } });
      await transaction.verification.deleteMany({ where: { identifier: user.email } });

      if (user.businessId) {
        // OrderItem.productId is intentionally RESTRICT, so remove the item
        // references before cascading the business and its products.
        await transaction.orderItem.deleteMany({
          where: { order: { businessId: user.businessId } },
        });
        await transaction.business.delete({ where: { id: user.businessId } });
      }

      await transaction.user.deleteMany({ where: { id: userId } });
      return assets;
    });
  }
}
