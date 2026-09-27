import { z } from 'zod';
import { phoneSchema } from '@/shared/validation/phone.js';
export const customerIdSchema = z.object({ customerId: z.string().trim().min(1) });
export const businessIdSchema = z.object({ businessId: z.string().trim().min(1) });
export const customerSchema = z
  .object({ name: z.string().trim().min(1).max(120), phone: phoneSchema })
  .strict();
export const updateCustomerSchema = customerSchema
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');
export const customerListSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().max(120).optional(),
  })
  .strict();
