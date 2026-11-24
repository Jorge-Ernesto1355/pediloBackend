import { describe, expect, it } from 'vitest';
import {
  aggregateRequirements,
  computeStockLevel,
  consumptionShare,
  isHighConsumption,
  isWorseLevel,
  lowStockThreshold,
  roundQuantity,
  type RecipeBook,
} from './stock.js';

describe('lowStockThreshold', () => {
  it('uses a percentage of the par level, falling back to the business default', () => {
    expect(
      lowStockThreshold({ parLevel: 5000, mode: 'PERCENT', value: 30, defaultPercent: 20 }),
    ).toBe(1500);
    expect(
      lowStockThreshold({ parLevel: 5000, mode: 'PERCENT', value: null, defaultPercent: 20 }),
    ).toBe(1000);
  });

  it('uses the absolute quantity as is, and 0 when it is not configured', () => {
    expect(
      lowStockThreshold({ parLevel: 5000, mode: 'ABSOLUTE', value: 500, defaultPercent: 20 }),
    ).toBe(500);
    expect(
      lowStockThreshold({ parLevel: 5000, mode: 'ABSOLUTE', value: null, defaultPercent: 20 }),
    ).toBe(0);
  });

  it('is 0 when there is no par level, so only an empty stock alerts', () => {
    expect(
      lowStockThreshold({ parLevel: 0, mode: 'PERCENT', value: null, defaultPercent: 20 }),
    ).toBe(0);
  });
});

describe('computeStockLevel', () => {
  it('classifies stock against the threshold', () => {
    expect(computeStockLevel(1001, 1000)).toBe('OK');
    expect(computeStockLevel(1000, 1000)).toBe('LOW');
    expect(computeStockLevel(501, 1000)).toBe('LOW');
    expect(computeStockLevel(500, 1000)).toBe('CRITICAL');
    expect(computeStockLevel(1, 1000)).toBe('CRITICAL');
    expect(computeStockLevel(0, 1000)).toBe('OUT');
    expect(computeStockLevel(-3, 1000)).toBe('OUT');
  });

  it('never reports low without a threshold', () => {
    expect(computeStockLevel(1, 0)).toBe('OK');
    expect(computeStockLevel(0, 0)).toBe('OUT');
  });

  it('orders levels by severity', () => {
    expect(isWorseLevel('CRITICAL', 'LOW')).toBe(true);
    expect(isWorseLevel('LOW', 'CRITICAL')).toBe(false);
    expect(isWorseLevel('LOW', 'LOW')).toBe(false);
  });
});

describe('consumption alerts', () => {
  it('measures what share of the available quantity was used in the window', () => {
    expect(consumptionShare(200, 800)).toBe(20);
    expect(consumptionShare(0, 800)).toBe(0);
    expect(consumptionShare(100, 0)).toBe(100);
  });

  it('flags consumption at or above the configured percentage', () => {
    expect(isHighConsumption(200, 800, 20)).toBe(true);
    expect(isHighConsumption(199, 800, 20)).toBe(false);
    expect(isHighConsumption(500, 500, 0)).toBe(false);
  });
});

describe('aggregateRequirements', () => {
  const book: RecipeBook = {
    byProduct: new Map([
      [
        'burger',
        [
          { ingredientId: 'meat', quantity: 150 },
          { ingredientId: 'bun', quantity: 1 },
        ],
      ],
    ]),
    byProductOption: new Map([['extra-cheese', [{ ingredientId: 'cheese', quantity: 30 }]]]),
    byGlobalOption: new Map([
      [
        'bacon',
        [
          { ingredientId: 'bacon', quantity: 20 },
          { ingredientId: 'meat', quantity: 10 },
        ],
      ],
    ]),
  };

  it('multiplies product and option recipes by the item quantity', () => {
    const totals = aggregateRequirements(
      [
        {
          productId: 'burger',
          quantity: 2,
          options: [{ productOptionId: 'extra-cheese' }, { globalOptionId: 'bacon' }],
        },
      ],
      book,
    );
    expect(Object.fromEntries(totals)).toEqual({ meat: 320, bun: 2, cheese: 60, bacon: 40 });
  });

  it('counts a repeated option once per occurrence', () => {
    const totals = aggregateRequirements(
      [
        {
          productId: 'burger',
          quantity: 1,
          options: [{ productOptionId: 'extra-cheese' }, { productOptionId: 'extra-cheese' }],
        },
      ],
      book,
    );
    expect(totals.get('cheese')).toBe(60);
  });

  it('adds up the same ingredient across several items', () => {
    const totals = aggregateRequirements(
      [
        { productId: 'burger', quantity: 1, options: [] },
        { productId: 'burger', quantity: 3, options: [] },
      ],
      book,
    );
    expect(totals.get('meat')).toBe(600);
  });

  it('ignores products and options without a recipe', () => {
    const totals = aggregateRequirements(
      [{ productId: 'soda', quantity: 4, options: [{ globalOptionId: 'unknown' }, {}] }],
      book,
    );
    expect(totals.size).toBe(0);
  });

  it('rounds to the stored precision to avoid float drift', () => {
    const totals = aggregateRequirements([{ productId: 'p', quantity: 3, options: [] }], {
      byProduct: new Map([['p', [{ ingredientId: 'i', quantity: 0.1 }]]]),
      byProductOption: new Map(),
      byGlobalOption: new Map(),
    });
    expect(totals.get('i')).toBe(0.3);
    expect(roundQuantity(0.1 + 0.2)).toBe(0.3);
  });
});
