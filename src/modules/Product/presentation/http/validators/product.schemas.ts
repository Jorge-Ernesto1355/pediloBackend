import { z } from 'zod';

const optionalBoolean = z.boolean().optional();

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
    active: optionalBoolean,
    isAvailable: optionalBoolean,

    imageUrl: z
      .string()
      .trim()
      .transform((value) => (value === '' ? null : value))
      .pipe(z.string().url().nullable())
      .optional(),
  })
  .strict();

export const updateProductSchema = z
  .object({
    name: z.string().trim().min(1).max(150).optional(),
    description: z.string().trim().max(1000).nullable().optional(),
    price: priceSchema.optional(),
    categoryId: z.string().trim().min(1).optional(),
    active: optionalBoolean,
    isAvailable: optionalBoolean,
    imageUrl: z.string().url().nullable().optional(),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
  })
  .strict();

export const productStatusSchema = z
  .object({ active: z.boolean().optional(), isAvailable: z.boolean().optional() })
  .strict()
  .refine(
    (value) => value.active !== undefined || value.isAvailable !== undefined,
    'Status is required',
  )
  .transform((value) => ({ isAvailable: value.active ?? value.isAvailable! }));
export const moveProductSchema = z.object({ targetCategoryId: z.string().trim().min(1) }).strict();
export const reorderProductsSchema = z
  .object({ productIds: z.array(z.string().trim().min(1)).max(100) })
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

const dateQuery = z.coerce.date().optional();
export const productAdminQuerySchema = z
  .object({
    categoryId: z.string().trim().min(1).optional(),
    active: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    isAvailable: z
      .enum(['true', 'false'])
      .transform((value) => value === 'true')
      .optional(),
    search: z.string().trim().min(1).max(150).optional(),
    from: dateQuery,
    to: dateQuery,
    createdFrom: dateQuery,
    createdTo: dateQuery,
    updatedFrom: dateQuery,
    updatedTo: dateQuery,
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    sortBy: z.enum(['name', 'price', 'createdAt', 'updatedAt', 'sortOrder']).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'from must be before to')
  .transform((value) => ({
    ...value,
    categoryId: value.categoryId === 'all' ? undefined : value.categoryId,
    isAvailable: value.active ?? value.isAvailable,
    createdFrom: value.createdFrom ?? value.from,
    createdTo: value.createdTo ?? value.to,
  }));

export const productAnalyticsQuerySchema = z
  .object({
    from: dateQuery,
    to: dateQuery,
    categoryId: z.string().trim().min(1).optional(),
    limit: z.coerce.number().int().min(1).max(100).default(10),
  })
  .strict()
  .refine((value) => !value.from || !value.to || value.from <= value.to, 'from must be before to')
  .transform((value) => ({
    ...value,
    categoryId: value.categoryId === 'all' ? undefined : value.categoryId,
  }));
