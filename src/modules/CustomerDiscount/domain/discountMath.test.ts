import { describe, expect, it } from 'vitest';
import { calculateCustomerDiscountAmount } from './discountMath.js';

describe('calculateCustomerDiscountAmount', () => {
  it('calculates percentage discounts and rounds to cents', () => {
    expect(calculateCustomerDiscountAmount('PERCENTAGE', 10, 250)).toBe(25);
    expect(calculateCustomerDiscountAmount('PERCENTAGE', 10, 12.34)).toBe(1.23);
  });

  it('caps fixed discounts at the subtotal', () => {
    expect(calculateCustomerDiscountAmount('FIXED_AMOUNT', 50, 250)).toBe(50);
    expect(calculateCustomerDiscountAmount('FIXED_AMOUNT', 50, 20)).toBe(20);
  });

  it('returns zero for invalid or empty amounts', () => {
    expect(calculateCustomerDiscountAmount('PERCENTAGE', 0, 100)).toBe(0);
    expect(calculateCustomerDiscountAmount('PERCENTAGE', Number.NaN, 100)).toBe(0);
    expect(calculateCustomerDiscountAmount('FIXED_AMOUNT', 20, 0)).toBe(0);
  });
});
