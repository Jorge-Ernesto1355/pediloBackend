import { z } from 'zod';
import { phoneSchema } from '@/shared/validation/phone.js';
import { loyaltyDesignSchema } from '../../domain/loyaltyDesign.js';
import { LOYALTY_LIMITS } from '../../domain/loyaltyProgram.js';

const id = z.string().trim().min(1).max(128);
const hasAtMostTwoDecimals = (value: number) =>
  Math.abs(Math.round(value * 100) - value * 100) < 1e-6;

export const customerParamsSchema = z.object({ customerId: id }).strict();
export const orderParamsSchema = z.object({ orderId: id }).strict();
export const stampParamsSchema = z.object({ stampId: id }).strict();
export const rewardParamsSchema = z.object({ rewardId: id }).strict();
export const slugParamsSchema = z.object({ slug: z.string().trim().min(1).max(120) }).strict();
/** El formato real se valida en el repositorio; aquí solo se limita el tamaño. */
export const tokenParamsSchema = z.object({ token: z.string().min(1).max(64) }).strict();

const { stampsRequired, percent, fixed, minOrderAmount, rewardExpiresDays, walkInDailyLimit } =
  LOYALTY_LIMITS;

export const loyaltyProgramSchema = z
  .object({
    enabled: z.boolean(),
    stampsRequired: z
      .number()
      .int('Usa un número entero de sellos.')
      .min(stampsRequired.min, `Elige entre ${stampsRequired.min} y ${stampsRequired.max} sellos.`)
      .max(stampsRequired.max, `Elige entre ${stampsRequired.min} y ${stampsRequired.max} sellos.`),
    stampMode: z.enum(['MANUAL', 'AUTO']),
    minOrderAmount: z
      .number()
      .finite()
      .min(minOrderAmount.min, 'El monto mínimo no puede ser negativo.')
      .max(minOrderAmount.max, 'El monto mínimo es demasiado alto.')
      .refine(hasAtMostTwoDecimals, 'Usa máximo dos decimales.'),
    rewardType: z.enum(['PERCENT', 'FIXED', 'FREE_PRODUCT']),
    rewardValue: z
      .number()
      .finite()
      .min(0)
      .max(fixed.max)
      .refine(hasAtMostTwoDecimals, 'Usa máximo dos decimales.'),
    rewardProductId: id.nullable().optional().default(null),
    rewardLabel: z
      .string()
      .trim()
      .max(
        LOYALTY_LIMITS.rewardLabelMaxLength,
        `Máximo ${LOYALTY_LIMITS.rewardLabelMaxLength} caracteres.`,
      )
      .nullable()
      .optional()
      .default(null),
    rewardExpiresDays: z
      .number()
      .int('Usa días completos.')
      .min(
        rewardExpiresDays.min,
        `Elige entre ${rewardExpiresDays.min} y ${rewardExpiresDays.max} días.`,
      )
      .max(
        rewardExpiresDays.max,
        `Elige entre ${rewardExpiresDays.min} y ${rewardExpiresDays.max} días.`,
      )
      .nullable()
      .optional()
      .default(null),
    walkInDailyLimit: z
      .number()
      .int()
      .min(walkInDailyLimit.min)
      .max(walkInDailyLimit.max)
      .optional()
      .default(5),
    design: loyaltyDesignSchema,
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.rewardType === 'PERCENT' &&
      (value.rewardValue < percent.min || value.rewardValue > percent.max)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rewardValue'],
        message: `El porcentaje va de ${percent.min} a ${percent.max}.`,
      });
    }
    if (
      value.rewardType === 'FIXED' &&
      (value.rewardValue < fixed.min || value.rewardValue > fixed.max)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rewardValue'],
        message: `El monto va de $${fixed.min} a $${fixed.max}.`,
      });
    }
    if (value.rewardType === 'FREE_PRODUCT' && !value.rewardProductId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rewardProductId'],
        message: 'Elige un producto de tu menú.',
      });
    }
  });

const reasonSchema = z
  .string()
  .trim()
  .min(3, 'Escribe el motivo.')
  .max(LOYALTY_LIMITS.reasonMaxLength, `Máximo ${LOYALTY_LIMITS.reasonMaxLength} caracteres.`);

export const voidStampSchema = z.object({ reason: reasonSchema }).strict();

export const walkInStampSchema = z
  .object({
    note: z
      .string()
      .trim()
      .max(LOYALTY_LIMITS.noteMaxLength, `Máximo ${LOYALTY_LIMITS.noteMaxLength} caracteres.`)
      .transform((value) => value || null)
      .nullable()
      .optional()
      .default(null),
  })
  .strict();

/** Para pedidos sin cliente: se vincula (o crea) por teléfono y se sella. */
export const stampOrderSchema = z
  .object({
    customer: z
      .object({ name: z.string().trim().min(1).max(60), phone: phoneSchema })
      .strict()
      .optional(),
  })
  .strict();

export const redeemRewardSchema = z
  .object({ orderId: id.nullable().optional().default(null) })
  .strict();

export const listCardsQuerySchema = z
  .object({
    search: z
      .string()
      .trim()
      .max(120)
      .transform((value) => value || undefined)
      .optional(),
    filter: z.enum(['all', 'near', 'reward']).default('all'),
    customerIds: z
      .string()
      .max(100 * 130)
      .transform((value) =>
        value
          .split(',')
          .map((entry) => entry.trim())
          .filter(Boolean),
      )
      .refine((value) => value.length <= 100, 'Máximo 100 clientes.')
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export const rewardQuoteSchema = z
  .object({
    cardToken: z.string().min(1).max(64),
    subtotal: z.number().finite().min(0).max(1_000_000),
  })
  .strict();
