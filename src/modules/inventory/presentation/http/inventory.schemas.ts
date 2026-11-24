import { z } from 'zod';

const id = z.string().trim().min(1).max(64);
const quantity = z.number().finite().positive().max(1_000_000_000);
const nonNegative = z.number().finite().min(0).max(1_000_000_000);
const percent = z.number().finite().min(0).max(100);

export const businessParamsSchema = z.object({ businessId: id });
export const ingredientParamsSchema = businessParamsSchema.extend({ ingredientId: id });
export const recipeTargetParamsSchema = businessParamsSchema.extend({
  kind: z.enum(['products', 'product-options', 'global-options']),
  targetId: id,
});

export const listIngredientsQuerySchema = z
  .object({
    search: z.string().trim().max(80).optional(),
    status: z.enum(['ALERTS', 'LOW', 'CRITICAL', 'OUT', 'OK']).optional(),
  })
  .strict();

export const createIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    unit: z.enum(['G', 'ML', 'UNIT']),
    initialStock: nonNegative.optional(),
    parLevel: nonNegative.optional(),
    lowStockMode: z.enum(['PERCENT', 'ABSOLUTE']).optional(),
    lowStockValue: nonNegative.nullable().optional(),
    consumptionAlertPercent: percent.nullable().optional(),
  })
  .strict()
  .refine((value) => value.lowStockMode !== 'PERCENT' || (value.lowStockValue ?? 0) <= 100, {
    message: 'A percentage threshold cannot exceed 100',
    path: ['lowStockValue'],
  });

export const updateIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    parLevel: nonNegative,
    lowStockMode: z.enum(['PERCENT', 'ABSOLUTE']),
    lowStockValue: nonNegative.nullable(),
    consumptionAlertPercent: percent.nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const movementSchema = z
  .object({
    type: z.enum(['PURCHASE', 'WASTE', 'ADJUSTMENT']),
    quantity: nonNegative,
    note: z.string().trim().max(200).nullable().optional(),
  })
  .strict()
  .refine((value) => value.type === 'ADJUSTMENT' || value.quantity > 0, {
    message: 'Quantity must be greater than zero',
    path: ['quantity'],
  });

export const movementsQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const recipeSchema = z
  .object({
    lines: z.array(z.object({ ingredientId: id, quantity }).strict()).max(50),
  })
  .strict();

export const settingsSchema = z
  .object({
    alertsEnabled: z.boolean(),
    defaultLowStockPercent: percent,
    consumptionAlertPercent: percent,
    consumptionWindowHours: z.number().int().min(1).max(720),
    blockMode: z.enum(['NONE', 'OUT_OF_STOCK', 'LOW_STOCK']),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
