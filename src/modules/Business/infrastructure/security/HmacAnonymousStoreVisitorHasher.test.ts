import { describe, expect, it } from 'vitest';
import { HmacAnonymousStoreVisitorHasher } from './HmacAnonymousStoreVisitorHasher.js';

describe('HmacAnonymousStoreVisitorHasher', () => {
  it('returns a stable opaque fingerprint and normalizes IPv4-mapped IPv6', () => {
    const hasher = new HmacAnonymousStoreVisitorHasher('test-secret');
    const first = hasher.hash('::ffff:192.0.2.1', 'Mozilla/5.0');
    expect(first).toBe(hasher.hash('192.0.2.1', 'Mozilla/5.0'));
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toContain('192.0.2.1');
  });
});
