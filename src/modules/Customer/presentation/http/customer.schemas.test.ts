import { describe, expect, it } from 'vitest';
import { customerSchema } from './customer.schemas.js';

describe('customerSchema', () => {
  it('accepts a customer name with 20 characters', () => {
    const result = customerSchema.safeParse({
      name: '12345678901234567890',
      phone: '6681234567',
    });

    expect(result.success).toBe(true);
  });

  it('rejects a customer name longer than 20 characters', () => {
    const result = customerSchema.safeParse({
      name: '123456789012345678901',
      phone: '6681234567',
    });

    expect(result.success).toBe(false);
  });
});
