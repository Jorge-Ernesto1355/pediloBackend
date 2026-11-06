import { describe, expect, it } from 'vitest';
import { createComboSchema } from './create-combo.schema.js';

const base = { categoryId: 'category-1', name: 'Combo hamburguesa', price: 199 };
const valid = { ...base, includedProductIds: ['burger'], optionGroups: [] };

describe('createComboSchema', () => {
  it('requires an included product', () => expect(createComboSchema.safeParse(base).success).toBe(false));
  it('defaults groups to one selection', () => expect(createComboSchema.parse({ ...valid, optionGroups: [{ name: 'g', productIds: ['a', 'b'] }] }).optionGroups[0]).toMatchObject({ minSelections: 1, maxSelections: 1 }));
  it('accepts exact upper boundaries', () => expect(createComboSchema.safeParse({ ...valid, name: 'x'.repeat(80), description: 'd'.repeat(100), price: 10_000_000, optionGroups: [{ name: 'g'.repeat(30), productIds: ['a', 'b'] }] }).success).toBe(true));
  it('accepts ten included products', () => expect(createComboSchema.safeParse({ ...base, includedProductIds: Array.from({ length: 10 }, (_, i) => `p-${i}`) }).success).toBe(true));
  it('accepts repeated included products through quantities', () => expect(createComboSchema.safeParse({ ...base, includedProducts: [{ productId: 'coke', quantity: 2 }, { productId: 'sushi', quantity: 1 }] }).success).toBe(true));
  it('rejects an included product quantity above ten', () => expect(createComboSchema.safeParse({ ...base, includedProducts: [{ productId: 'coke', quantity: 11 }] }).success).toBe(false));
  it('allows ten units for each included product', () => expect(createComboSchema.safeParse({ ...base, includedProducts: [{ productId: 'coke', quantity: 10 }, { productId: 'sushi', quantity: 10 }] }).success).toBe(true));
  it('rejects more than ten included products', () => expect(createComboSchema.safeParse({ ...base, includedProductIds: Array.from({ length: 11 }, (_, i) => `p-${i}`) }).success).toBe(false));
  it('accepts five groups', () => expect(createComboSchema.safeParse({ ...valid, optionGroups: Array.from({ length: 5 }, (_, i) => ({ name: `g-${i}`, productIds: [`a-${i}`, `b-${i}`] })) }).success).toBe(true));
  it('rejects more than five groups', () => expect(createComboSchema.safeParse({ ...valid, optionGroups: Array.from({ length: 6 }, (_, i) => ({ name: `g-${i}`, productIds: [`a-${i}`, `b-${i}`] })) }).success).toBe(false));
  it('accepts five choices in one group', () => expect(createComboSchema.safeParse({ ...valid, optionGroups: [{ name: 'g', productIds: Array.from({ length: 5 }, (_, i) => `p-${i}`) }] }).success).toBe(true));
  it('rejects more than five choices in one group', () => expect(createComboSchema.safeParse({ ...valid, optionGroups: [{ name: 'g', productIds: Array.from({ length: 6 }, (_, i) => `p-${i}`) }] }).success).toBe(false));
  it('rejects an empty name', () => expect(createComboSchema.safeParse({ ...valid, name: ' ' }).success).toBe(false));
  it('rejects a name over 80 characters', () => expect(createComboSchema.safeParse({ ...valid, name: 'x'.repeat(81) }).success).toBe(false));
  it('rejects a description over 100 characters', () => expect(createComboSchema.safeParse({ ...valid, description: 'x'.repeat(101) }).success).toBe(false));
  it('rejects an option group name over 30 characters', () => expect(createComboSchema.safeParse({ ...valid, optionGroups: [{ name: 'x'.repeat(31), productIds: ['a', 'b'] }] }).success).toBe(false));
  it('rejects a zero price', () => expect(createComboSchema.safeParse({ ...valid, price: 0 }).success).toBe(false));
  it('rejects a negative price', () => expect(createComboSchema.safeParse({ ...valid, price: -1 }).success).toBe(false));
  it('rejects a price with more than two decimals', () => expect(createComboSchema.safeParse({ ...valid, price: 10.999 }).success).toBe(false));
  it('rejects a price above the maximum', () => expect(createComboSchema.safeParse({ ...valid, price: 10_000_000.01 }).success).toBe(false));
  it('rejects duplicate included products', () => expect(createComboSchema.safeParse({ ...base, includedProductIds: ['a', 'a'] }).success).toBe(false));
  it('rejects a product used as both included and selectable', () => expect(createComboSchema.safeParse({ ...valid, optionGroups: [{ name: 'g', productIds: ['burger', 'b'] }] }).success).toBe(false));
  it('rejects fewer than two choices in a group', () => expect(createComboSchema.safeParse({ ...valid, optionGroups: [{ name: 'g', productIds: ['a'] }] }).success).toBe(false));
  it('rejects a maximum greater than available choices', () => expect(createComboSchema.safeParse({ ...valid, optionGroups: [{ name: 'g', maxSelections: 3, productIds: ['a', 'b'] }] }).success).toBe(false));
});
