import { z } from 'zod';
import { phoneSchema } from '@/shared/validation/phone.js';
export const orderIdSchema = z.object({ orderId: z.string().trim().min(1) });
export const businessIdSchema = z.object({ businessId: z.string().trim().min(1) });
const itemSchema = z
  .object({
    productId: z.string().trim().min(1),
    quantity: z.number().int().min(1).max(100),
    optionIds: z.array(z.string().trim().min(1)).max(50).optional(),
  })
  .strict();
export const createOrderSchema = z
  .object({
    customer: z.object({ name: z.string().trim().min(1).max(120), phone: phoneSchema }).strict(),
    items: z.array(itemSchema).min(1).max(100),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
export const createRestaurantOrderSchema = z
  .object({
    customerName: z.string().trim().min(1).max(120).nullable().optional(),
    customerPhone: phoneSchema.nullable().optional(),
    items: z.array(itemSchema).min(1).max(100),
    notes: z.string().trim().max(1000).nullable().optional(),
  })
  .strict();
export const orderStatusSchema = z
  .object({
    status: z.enum(['PENDING', 'PREPARING', 'READY', 'CANCELLED']),
  })
  .strict();
export const orderListSchema = z
  .object({
    period: z.enum(['today', '7d', '30d', 'lastMonth']).optional(),
    status: z.enum(['PENDING', 'PREPARING', 'READY', 'CANCELLED']).optional(),
    search: z
      .string()
      .trim()
      .max(120)
      .transform((value) => value || undefined)
      .optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();
