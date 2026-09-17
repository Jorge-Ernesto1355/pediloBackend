import { z } from 'zod';

export const productIdSchema = z.object({ productId: z.string().trim().min(1) });
export const optionGroupIdSchema = z.object({ optionGroupId: z.string().trim().min(1) });
export const optionIdSchema = z.object({ optionId: z.string().trim().min(1) });

const optionPriceSchema = z
  .number()
  .finite()
  .min(0)
  .max(10_000_000)
  .refine(
    (value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8,
    'Price must have at most two decimal places',
  );

export const createOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    price: optionPriceSchema.optional(),
    isAvailable: z.boolean().optional(),
  })
  .strict();

export const createOptionGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    isRequired: z.boolean().optional(),
    minSelections: z.number().int().min(0).max(100).optional(),
    maxSelections: z.number().int().min(0).max(100).optional(),
    isActive: z.boolean().optional(),
    options: z.array(createOptionSchema).max(100).optional(),
  })
  .strict()
  .superRefine(validateSelectionConfiguration);

export const updateOptionGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    isRequired: z.boolean().optional(),
    minSelections: z.number().int().min(0).max(100).optional(),
    maxSelections: z.number().int().min(0).max(100).optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const updateOptionSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    price: optionPriceSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const groupStatusSchema = z.object({ isActive: z.boolean() }).strict();
export const optionStatusSchema = z.object({ isAvailable: z.boolean() }).strict();
export const reorderGroupSchema = z
  .object({ optionGroupIds: z.array(z.string().trim().min(1)) })
  .strict();
export const reorderOptionSchema = z
  .object({ optionIds: z.array(z.string().trim().min(1)) })
  .strict();

function validateSelectionConfiguration(
  value: { isRequired?: boolean; minSelections?: number; maxSelections?: number },
  context: z.RefinementCtx,
) {
  const min = value.minSelections ?? 0;
  const max = value.maxSelections ?? 1;
  if (max < min)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'maxSelections must be greater than or equal to minSelections',
      path: ['maxSelections'],
    });
  if (value.isRequired === true && min < 1)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Required groups must have minSelections >= 1',
      path: ['minSelections'],
    });
}
