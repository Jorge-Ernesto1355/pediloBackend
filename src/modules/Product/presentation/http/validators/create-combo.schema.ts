import { z } from 'zod';

const id = z.string().trim().min(1).max(100);
const group = z
  .object({
    name: z.string().trim().min(1).max(30),
    minSelections: z.number().int().min(0).max(5).default(1),
    maxSelections: z.number().int().min(1).max(5).default(1),
    productIds: z.array(id).min(2, 'Cada grupo debe ofrecer al menos dos productos.').max(5),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.minSelections > value.maxSelections ||
      value.maxSelections > value.productIds.length
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['maxSelections'],
        message: 'Los límites deben ser válidos para la cantidad de opciones.',
      });
    }
    if (new Set(value.productIds).size !== value.productIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['productIds'],
        message: 'No repitas productos dentro del grupo.',
      });
    }
  });

export const createComboSchema = z
  .object({
    categoryId: id,
    name: z.string().trim().min(1).max(80),
    description: z.string().trim().max(100).nullable().optional(),
    price: z
      .number()
      .finite()
      .min(0.01)
      .max(10_000_000)
      .refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-8, {
        message: 'El precio debe tener máximo dos decimales.',
      }),
    imageUrl: z.string().trim().url().nullable().optional(),
    isAvailable: z.boolean().optional(),
    includedProductIds: z
      .array(id)
      .min(1, 'Selecciona al menos un producto incluido.')
      .max(10, 'A combo can include at most 10 included products'),
    optionGroups: z.array(group).max(5, 'A combo can have at most 5 option groups').default([]),
  })
  .strict()
  .superRefine((value, ctx) => {
    const all = [...value.includedProductIds, ...value.optionGroups.flatMap((g) => g.productIds)];
    if (new Set(value.includedProductIds).size !== value.includedProductIds.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['includedProductIds'],
        message: 'No repitas productos incluidos.',
      });
    }
    if (new Set(all).size !== all.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['optionGroups'],
        message:
          'Un producto no puede ser obligatorio y opción, ni repetirse en varios grupos del mismo combo.',
      });
    }
  });
