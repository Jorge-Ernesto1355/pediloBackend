import { describe, expect, it } from 'vitest';
import { createComboOptionGroupSchema, updateComboOptionGroupSchema } from './combo-option.schemas.js';

describe('combo option group schemas', () => {
  it('defaults to one required selection', () => {
    expect(createComboOptionGroupSchema.parse({ name: 'Acompañamiento', productIds: ['a', 'b'] })).toMatchObject({ minSelections: 1, maxSelections: 1 });
  });
  it('rejects a create name over 30 characters', () => expect(createComboOptionGroupSchema.safeParse({ name: 'x'.repeat(31), productIds: ['a', 'b'] }).success).toBe(false));
  it('rejects an update name over 30 characters', () => expect(updateComboOptionGroupSchema.safeParse({ name: 'x'.repeat(31) }).success).toBe(false));
  it('accepts a name at exactly 30 characters', () => {
    expect(createComboOptionGroupSchema.safeParse({ name: 'x'.repeat(30), productIds: ['a', 'b'] }).success).toBe(true);
    expect(updateComboOptionGroupSchema.safeParse({ name: 'x'.repeat(30) }).success).toBe(true);
  });
  it('rejects fewer than two alternatives', () => expect(createComboOptionGroupSchema.safeParse({ name: 'g', productIds: ['a'] }).success).toBe(false));
  it('accepts five alternatives', () => expect(createComboOptionGroupSchema.safeParse({ name: 'g', productIds: ['a', 'b', 'c', 'd', 'e'] }).success).toBe(true));
  it('rejects more than five alternatives', () => expect(createComboOptionGroupSchema.safeParse({ name: 'g', productIds: ['a', 'b', 'c', 'd', 'e', 'f'] }).success).toBe(false));
  it('rejects a minimum greater than the maximum', () => expect(createComboOptionGroupSchema.safeParse({ name: 'g', minSelections: 2, maxSelections: 1, productIds: ['a', 'b'] }).success).toBe(false));
  it('rejects a maximum greater than the number of choices', () => expect(createComboOptionGroupSchema.safeParse({ name: 'g', maxSelections: 2, productIds: ['a'] }).success).toBe(false));
  it('rejects duplicate products', () => expect(createComboOptionGroupSchema.safeParse({ name: 'g', productIds: ['a', 'a'] }).success).toBe(false));
  it('rejects a minimum greater than the number of products', () => expect(createComboOptionGroupSchema.safeParse({ name: 'g', minSelections: 2, productIds: ['a'] }).success).toBe(false));
  it('allows a partial update', () => expect(updateComboOptionGroupSchema.parse({ name: 'Bebida' })).toEqual({ name: 'Bebida' }));
  it('rejects an empty update', () => expect(updateComboOptionGroupSchema.safeParse({}).success).toBe(false));
  it('rejects an update with an inverted range', () => expect(updateComboOptionGroupSchema.safeParse({ minSelections: 2, maxSelections: 1 }).success).toBe(false));
});
