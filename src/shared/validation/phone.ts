import { z } from 'zod';

const MEXICAN_PHONE_FORMAT = /^[0-9()\s-]+$/;

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone is required')
  .regex(MEXICAN_PHONE_FORMAT, 'Phone must contain only digits or formatting characters')
  .transform(normalizePhone)
  .refine((phone) => /^\d{10}$/.test(phone), 'Phone must contain exactly 10 digits');
