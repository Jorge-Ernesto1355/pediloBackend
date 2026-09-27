import { z } from 'zod';
import { phoneSchema } from '@/shared/validation/phone.js';

const nullablePhone = phoneSchema.nullable();
const nullableText = z.string().trim().min(1).nullable();

const timezoneSchema = z.string().trim().min(1).refine(isIanaTimezone, {
  message: 'Invalid IANA timezone',
});

export const createBusinessSettingsSchema = z
  .object({
    currency: z.enum(['MXN', 'USD']).default('MXN'),
    phone: nullablePhone.optional().default(null),
    whatsapp: nullablePhone.optional().default(null),
    address: nullableText.optional().default(null), 
    timezone: timezoneSchema.default('America/Mazatlan'),
  })
  .strict();

export const updateBusinessSettingsSchema = z
  .object({
    currency: z.enum(['MXN', 'USD']).optional(),
    phone: nullablePhone.optional(),
    whatsapp: nullablePhone.optional(),
    address: nullableText.optional(),
    timezone: timezoneSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'At least one field is required',
  });

function isIanaTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
}
