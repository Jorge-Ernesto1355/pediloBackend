import { describe, expect, it } from 'vitest';
import { resolveComboSelections } from './comboSelection.js';

const groups = [
  {
    id: 'drinks',
    name: 'Bebida',
    minSelections: 1,
    maxSelections: 1,
    products: [
      { id: 'choice-water', productId: 'water', name: 'Agua', isAvailable: true },
      { id: 'choice-soda', productId: 'soda', name: 'Refresco', isAvailable: true },
    ],
  },
];

describe('resolveComboSelections', () => {
  it('resolves a valid choice and preserves its group for order history', () => {
    expect(resolveComboSelections(groups, ['choice-soda'])).toEqual([
      { name: 'Refresco', groupName: 'Bebida', price: 0 },
    ]);
  });

  it('rejects a missing required choice', () => {
    expect(resolveComboSelections(groups, [])).toBeNull();
  });

  it('rejects more choices than the group maximum', () => {
    expect(resolveComboSelections(groups, ['choice-water', 'choice-soda'])).toBeNull();
  });

  it('rejects duplicated choice identifiers', () => {
    expect(resolveComboSelections(groups, ['choice-soda', 'choice-soda'])).toBeNull();
  });

  it('rejects an unknown choice identifier', () => {
    expect(resolveComboSelections(groups, ['unknown'])).toBeNull();
  });

  it('rejects a choice whose product is unavailable', () => {
    expect(
      resolveComboSelections(
        groups.map((group) => ({
          ...group,
          products: group.products.map((product) => ({ ...product, isAvailable: false })),
        })),
        ['choice-soda'],
      ),
    ).toBeNull();
  });
});
