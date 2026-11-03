import { Router } from 'express';
import { ProductType } from '@prisma/client';
import { prisma } from '@/libs/prisma.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { createComboSchema } from './validators/create-combo.schema.js';

const requireAuth = createRequireAuth(authProvider);
export const createComboRouter = Router();

createComboRouter.post('/products/combos', requireAuth, async (request, response, next) => {
  const input = createComboSchema.safeParse(request.body);
  if (!input.success) return response.status(400).json({ error: input.error.flatten() });
  const { categoryId, includedProductIds, optionGroups, ...fields } = input.data;
  const userId = request.user!.id;
  try {
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { businessId: true },
      });
      if (!user?.businessId) return { error: 'BUSINESS_NOT_FOUND' as const };
      const category = await tx.category.findFirst({
        where: { id: categoryId, businessId: user.businessId },
        select: { id: true },
      });
      if (!category) return { error: 'CATEGORY_NOT_FOUND' as const };

      const relatedIds = [
        ...new Set([...includedProductIds, ...optionGroups.flatMap((g) => g.productIds)]),
      ];
      const products = await tx.product.findMany({
        where: { id: { in: relatedIds }, businessId: user.businessId, type: ProductType.PRODUCT },
        select: { id: true },
      });
      if (products.length !== relatedIds.length)
        return { error: 'INVALID_RELATED_PRODUCTS' as const };

      const aggregate = await tx.product.aggregate({
        where: { categoryId },
        _max: { sortOrder: true },
      });
      const combo = await tx.product.create({
        data: {
          ...fields,
          type: ProductType.COMBO,
          businessId: user.businessId,
          categoryId,
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
          comboIncludes: {
            create: includedProductIds.map((productId, sortOrder) => ({
              businessId: user.businessId!,
              productId,
              sortOrder,
            })),
          },
          comboOptionGroups: {
            create: optionGroups.map((g, sortOrder) => ({
              businessId: user.businessId!,
              name: g.name,
              minSelections: g.minSelections,
              maxSelections: g.maxSelections,
              sortOrder,
              products: {
                create: g.productIds.map((productId, choiceOrder) => ({
                  productId,
                  sortOrder: choiceOrder,
                })),
              },
            })),
          },
        },
        include: {
          category: { select: { id: true, name: true, menuId: true } },
          comboIncludes: {
            orderBy: { sortOrder: 'asc' },
            include: { product: { select: { id: true, name: true } } },
          },
          comboOptionGroups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              products: {
                orderBy: { sortOrder: 'asc' },
                include: { product: { select: { id: true, name: true } } },
              },
            },
          },
        },
      });
      return { combo };
    });
    if ('error' in result) {
      const status =
        result.error === 'BUSINESS_NOT_FOUND'
          ? 404
          : result.error === 'CATEGORY_NOT_FOUND'
            ? 404
            : 400;
      return response.status(status).json({ error: result.error });
    }
    return response.status(201).json(result);
  } catch (error) {
    return next(error);
  }
});
