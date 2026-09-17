import { z } from 'zod';

export const categoryIdSchema = z.object({ id: z.string().trim().min(1) });
export const businessIdSchema = z.object({ businessId: z.string().trim().min(1) });
export const menuIdSchema = z.object({ menuId: z.string().trim().min(1) });

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    menuId: z.string().trim().min(1),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict();

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const categoryStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const reorderCategoriesSchema = z
  .object({ categoryIds: z.array(z.string().trim().min(1)).min(0) })
  .strict();
export const moveAllProductsSchema = z
  .object({ targetCategoryId: z.string().trim().min(1) })
  .strict();
