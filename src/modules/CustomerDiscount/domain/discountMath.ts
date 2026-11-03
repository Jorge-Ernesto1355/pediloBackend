import type { CustomerDiscountType } from '@prisma/client';

export const DEFAULT_CUSTOMER_DISCOUNT_EXPIRY_DAYS = 30;
export const MAX_CUSTOMER_DISCOUNT_PERCENTAGE = 100;
export const MAX_CUSTOMER_FIXED_DISCOUNT = 10_000;

export function calculateCustomerDiscountAmount(
  type: CustomerDiscountType,
  value: number,
  subtotal: number,
) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(subtotal) || subtotal <= 0) return 0;
  const amount = type === 'PERCENTAGE' ? (subtotal * value) / 100 : value;
  return Math.min(subtotal, Math.round(amount * 100) / 100);
}
