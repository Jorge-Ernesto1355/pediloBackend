import { Router } from 'express';
import { ProductType } from '@prisma/client';
import multer from 'multer';
import { prisma } from '@/libs/prisma.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { isSupportedImageFile } from '@/shared/validation/image-file.js';
import { CloudinaryProductImageStorage } from '../../infrastructure/storage/CloudinaryProductImageStorage.js';
import { createComboSchema } from './validators/create-combo.schema.js';

const requireAuth = createRequireAuth(authProvider);
const imageStorage = new CloudinaryProductImageStorage();
const uploadProductImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_request, file, callback) => callback(null, file.mimetype.startsWith('image/')),
});
export const createComboRouter = Router();

createComboRouter.post('/products/combos', requireAuth, uploadProductImage.single('image'), async (request, response, next) => {
  if (request.file && !isSupportedImageFile(request.file)) {
    return response.status(400).json({ error: 'Unsupported or invalid image file' });
  }
  const input = createComboSchema.safeParse(parseMultipartBody(request.body));
  if (!input.success) return response.status(400).json({ error: input.error.flatten() });
  const { categoryId, includedProductIds, includedProducts, optionGroups, ...fields } = input.data;
  const normalizedIncludedProducts = includedProducts ?? includedProductIds!.map((productId) => ({ productId, quantity: 1 }));
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
        ...new Set([...normalizedIncludedProducts.map((item) => item.productId), ...optionGroups.flatMap((g) => g.productIds)]),
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
            create: normalizedIncludedProducts.map(({ productId, quantity }, sortOrder) => ({
              businessId: user.businessId!,
              productId,
              quantity,
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
    if (!request.file) return response.status(201).json(result);

    let uploadedPublicId: string | undefined;
    try {
      const image = await imageStorage.upload(
        { buffer: request.file.buffer, mimetype: request.file.mimetype },
        `products/${result.combo.id}`,
      );
      uploadedPublicId = image.publicId;
      await prisma.product.update({
        where: { id: result.combo.id },
        data: { imageUrl: image.url, imageBlurUrl: image.blurUrl, imagePublicId: image.publicId },
      });
      return response.status(201).json({
        combo: { ...result.combo, imageUrl: image.url, imageBlurUrl: image.blurUrl },
      });
    } catch (error) {
      if (uploadedPublicId) await imageStorage.delete(uploadedPublicId).catch(() => undefined);
      await prisma.product.delete({ where: { id: result.combo.id } }).catch(() => undefined);
      return next(error);
    }
  } catch (error) {
    return next(error);
  }
});

function parseMultipartBody(body: Record<string, unknown>): Record<string, unknown> {
  const normalized = { ...body };
  if (typeof normalized.price === 'string') normalized.price = Number(normalized.price);
  for (const field of ['includedProducts', 'includedProductIds', 'optionGroups']) {
    if (typeof normalized[field] === 'string') {
      try {
        normalized[field] = JSON.parse(normalized[field]);
      } catch {
        // Let Zod return the normal validation error for malformed JSON fields.
      }
    }
  }
  return normalized;
}
