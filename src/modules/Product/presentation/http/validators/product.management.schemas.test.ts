import { describe, expect, it } from 'vitest';
import { productAdminQuerySchema, productAnalyticsQuerySchema } from './product.schemas.js';

describe('product management query schemas', () => {
  it('validates filters and maps active to the persisted isAvailable field', () => {
    const result = productAdminQuerySchema.parse({
      active: 'true',
      categoryId: 'all',
      from: '2026-09-01',
      to: '2026-09-18',
      page: '2',
      limit: '10',
    });
    expect(result.isAvailable).toBe(true);
    expect(result.categoryId).toBeUndefined();
    expect(result.page).toBe(2);
  });

  it('rejects an inverted date range', () => {
    expect(() =>
      productAnalyticsQuerySchema.parse({ from: '2026-09-18', to: '2026-09-01' }),
    ).toThrow();
  });
});
