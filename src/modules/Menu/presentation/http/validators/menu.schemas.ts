import { z } from 'zod';

export const menuIdSchema = z.object({ id: z.string().trim().min(1) });
export const businessIdSchema = z.object({ businessId: z.string().trim().min(1) });

const categoryInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
});

export const createMenuSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    description: z.string().trim().max(500).nullable().optional(),
    isActive: z.boolean().optional(),
    categories: z.array(categoryInputSchema).max(100).optional(),
  })
  .strict();

export const updateMenuSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(500).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const menuStatusSchema = z.object({ isActive: z.boolean() }).strict();
