import { describe, expect, it } from 'vitest';
import {
  createOrderSchema,
  createRestaurantOrderSchema,
  orderListSchema,
  updateOrderSchema,
} from './order.schemas.js';

describe('order list period validation', () => {
  it.each(['today', '7d', '30d', 'lastMonth'])('accepts period=%s', (period) => {
    expect(orderListSchema.parse({ period })).toMatchObject({ period });
  });

  it('rejects an unknown period instead of ignoring it', () => {
    expect(orderListSchema.safeParse({ period: 'yesterday' }).success).toBe(false);
  });

  it('keeps period optional for the existing unfiltered behavior', () => {
    expect(orderListSchema.parse({})).toMatchObject({ page: 1, limit: 20 });
  });
});

describe('order creation schemas', () => {
  it('accepts the public snake_case payment method', () => {
    const parsed = createOrderSchema.safeParse({
      customer: { name: 'Juan', phone: '6681234567' },
      items: [{ productId: 'p1', quantity: 1 }],
      payment_method: 'transfer',
    });
    expect(parsed.success).toBe(true);
  });

  it('keeps public phone required', () => {
    expect(
      createOrderSchema.safeParse({
        customer: { name: 'Juan' },
        items: [{ productId: 'p1', quantity: 1 }],
      }).success,
    ).toBe(false);
  });

  it('allows restaurant orders with no phone and normalizes a provided phone', () => {
    expect(
      createRestaurantOrderSchema.parse({
        customerName: 'Juan',
        customerPhone: '(668) 123-4567',
        items: [{ productId: 'p1', quantity: 1 }],
      }),
    ).toMatchObject({ customerName: 'Juan', customerPhone: '6681234567' });
    expect(
      createRestaurantOrderSchema.parse({
        customerName: 'Juan',
        customerPhone: null,
        items: [{ productId: 'p1', quantity: 1 }],
      }).customerPhone,
    ).toBeNull();
  });
});

describe('order update schema', () => {
  it('accepts ids for existing order items', () => {
    expect(
      updateOrderSchema.parse({
        expectedVersion: 1,
        customerId: 'customer-1',
        items: [{ id: 'item-1', productId: 'product-1', quantity: 1 }],
      }).items[0],
    ).toMatchObject({ id: 'item-1', productId: 'product-1' });
  });
});
