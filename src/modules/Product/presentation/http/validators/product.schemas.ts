import { z } from 'zod';

export const productIdSchema = z.object({ productId: z.string().trim().min(1) });
export const businessIdSchema = z.object({ businessId: z.string().trim().min(1) });
export const categoryIdSchema = z.object({ categoryId: z.string().trim().min(1) });

const priceSchema = z
  .number()
  .finite()
  .min(0)
  .max(10_000_000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
    'Price must have at most two decimal places',
  );

export const createProductSchema = z
  .object({
    categoryId: z.string().trim().min(1),
    name: z.string().trim().min(1).max(150),
    description: z.string().trim().max(1000).nullable().optional(),
    price: priceSchema,

    imageUrl: z
      .string()
      .trim()
      .transform((value) => (value === '' ? null : value))
      .pipe(z.string().url().nullable()),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    price: priceSchema.optional(),
    imageUrl: z.string().url().nullable().optional(),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const productStatusSchema = z.object({ isAvailable: z.boolean() }).strict();
export const moveProductSchema = z.object({ targetCategoryId: z.string().trim().min(1) }).strict();
export const reorderProductsSchema = z
  .object({ productIds: z.array(z.string().trim().min(1)) })
  .strict();
export const productListQuerySchema = z
  .object({
    categoryId: z.string().trim().min(1).optional(),
    isAvailable: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
  })
  .strict();
