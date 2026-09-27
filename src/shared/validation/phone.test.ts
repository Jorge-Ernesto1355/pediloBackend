import { describe, expect, it } from 'vitest';
import { normalizePhone, phoneSchema } from './phone.js';

describe('Mexican customer phone identity', () => {
  it('normalizes supported formatting to ten digits', () => {
    expect(normalizePhone('(669) 123-4567')).toBe('6691234567');
    expect(phoneSchema.parse('669-123 4567')).toBe('6691234567');
  });

  it('requires a valid ten-digit phone', () => {
    expect(() => phoneSchema.parse(undefined)).toThrow();
    expect(() => phoneSchema.parse('669-123-456')).toThrow();
    expect(() => phoneSchema.parse('+52 669 123 4567')).toThrow();
    expect(() => phoneSchema.parse('669 ABC 4567')).toThrow();
  });
});
