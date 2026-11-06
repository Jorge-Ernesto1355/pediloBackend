import { describe, expect, it } from 'vitest';
import { bestDiscountFor } from './pricing.js';

describe('discount priority', () => {
  it('uses the most recently created applicable discount instead of the largest discount', () => {
    const now = new Date('2026-11-05T12:00:00.000Z');
    const product = { id: 'product-1', price: 100, categoryId: 'category-1' };
    const selected = bestDiscountFor(product, [
      { id: 'older', type: 'PERCENT', value: 20, startsAt: new Date('2026-11-01'), endsAt: new Date('2026-12-01'), createdAt: new Date('2026-11-01'), target: { scope: 'CATEGORIES', categoryIds: ['category-1'] } },
      { id: 'newer', type: 'PERCENT', value: 10, startsAt: new Date('2026-11-01'), endsAt: new Date('2026-12-01'), createdAt: new Date('2026-11-05'), target: { scope: 'PRODUCTS', productIds: ['product-1'] } },
    ], now);
    expect(selected?.id).toBe('newer');
  });
});
