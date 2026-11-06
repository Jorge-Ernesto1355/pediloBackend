import { z } from 'zod';

const idSchema = z.string().trim().min(1).max(100);
const selectionsSchema = z.number().int().min(0).max(5);

export const comboProductParamsSchema = z.object({ productId: idSchema }).strict();

export const comboOptionGroupParamsSchema = z
  .object({ productId: idSchema, groupId: idSchema })
  .strict();

export const comboChoiceProductParamsSchema = z
  .object({ productId: idSchema, groupId: idSchema, choiceProductId: idSchema })
  .strict();

export const comboIncludedProductParamsSchema = z
  .object({ productId: idSchema, includedProductId: idSchema })
  .strict();

export const createComboOptionGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(30),
    minSelections: selectionsSchema.default(1),
    maxSelections: z.number().int().min(1).max(5).default(1),
    productIds: z
      .array(idSchema)
      .min(2, 'Cada grupo debe ofrecer al menos dos productos.')
      .max(5),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.minSelections > input.maxSelections) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxSelections'],
        message: 'El máximo debe ser igual o mayor que el mínimo.',
      });
    }
    if (input.minSelections > input.productIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productIds'],
        message: 'Agrega al menos tantos productos como el mínimo de selecciones.',
      });
    }
    if (input.maxSelections > input.productIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxSelections'],
        message: 'El máximo no puede superar la cantidad de productos disponibles.',
      });
    }
    if (new Set(input.productIds).size !== input.productIds.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productIds'],
        message: 'No repitas productos dentro del grupo.',
      });
    }
  });

export const updateComboOptionGroupSchema = z
  .object({
    name: z.string().trim().min(1).max(30).optional(),
    minSelections: selectionsSchema.optional(),
    maxSelections: z.number().int().min(1).max(5).optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'Envía al menos un campo para actualizar.')
  .refine(
    (input) =>
      input.minSelections === undefined ||
      input.maxSelections === undefined ||
      input.maxSelections >= input.minSelections,
    'El máximo debe ser igual o mayor que el mínimo.',
  );

export const addComboChoiceProductSchema = z.object({ productId: idSchema }).strict();

export const updateComboIncludedProductSchema = z
  .object({ quantity: z.number().int().min(1).max(10) })
  .strict();
