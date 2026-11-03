import { PrismaClient } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ComboChoiceProductNotFoundError } from '../../domain/errors/ComboOptionErrors.js';
import { PrismaComboOptionRepository } from './PrismaComboOptionRepository.js';

const mocks = vi.hoisted(() => ({
  findCombo: vi.fn(),
  findChoices: vi.fn(),
  aggregateGroups: vi.fn(),
  createGroup: vi.fn(),
  includedFindFirst: vi.fn(),
  includedDelete: vi.fn(),
  transaction: vi.fn(),
}));

const prismaMock = {
  product: {
    findFirst: mocks.findCombo,
    findMany: mocks.findChoices,
  },
  comboOptionGroup: {
    aggregate: mocks.aggregateGroups,
    create: mocks.createGroup,
  },
  comboIncludedProduct: {
    findFirst: mocks.includedFindFirst,
    delete: mocks.includedDelete,
  },
  $transaction: mocks.transaction,
} as unknown as PrismaClient;

function comboOptionGroupRow() {
  return {
    id: 'group-1',
    businessId: 'business-1',
    comboProductId: 'combo-1',
    name: 'Elige acompañamiento',
    minSelections: 1,
    maxSelections: 1,
    sortOrder: 0,
    createdAt: new Date('2026-10-30T00:00:00.000Z'),
    updatedAt: new Date('2026-10-30T00:00:00.000Z'),
    products: [
      {
        id: 'choice-link-1',
        productId: 'wings-1',
        sortOrder: 0,
        product: {
          id: 'wings-1',
          name: 'Alitas',
          description: null,
          price: { toNumber: () => 75 },
          imageUrl: null,
          categoryId: 'category-1',
          isAvailable: true,
          category: { id: 'category-1', name: 'Acompañamientos', menuId: 'menu-1' },
        },
      },
    ],
  };
}

describe('PrismaComboOptionRepository', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.findCombo.mockResolvedValue({ id: 'combo-1', businessId: 'business-1' });
    mocks.findChoices.mockResolvedValue([{ id: 'wings-1' }]);
    mocks.aggregateGroups.mockResolvedValue({ _max: { sortOrder: null } });
    mocks.createGroup.mockResolvedValue(comboOptionGroupRow());
    mocks.transaction.mockImplementation((callback) => callback(prismaMock));
  });

  it('persists references to same-business products without copying their details', async () => {
    const repository = new PrismaComboOptionRepository(prismaMock);
    const result = await repository.createGroup('owner-1', 'combo-1', {
      name: 'Elige acompañamiento',
      minSelections: 1,
      maxSelections: 1,
      productIds: ['wings-1'],
    });

    expect(result.products[0]).toMatchObject({
      productId: 'wings-1',
      product: { name: 'Alitas', price: 75 },
    });
    const productLinks = mocks.createGroup.mock.calls[0]?.[0].data.products.create;
    expect(productLinks).toEqual([{ productId: 'wings-1', sortOrder: 0 }]);
    expect(productLinks?.[0]).not.toHaveProperty('name');
    expect(productLinks?.[0]).not.toHaveProperty('price');
  });

  it('rejects choice products from another business before writing the group', async () => {
    mocks.findChoices.mockResolvedValue([]);
    const repository = new PrismaComboOptionRepository(prismaMock);

    await expect(
      repository.createGroup('owner-1', 'combo-1', {
        name: 'Elige acompañamiento',
        minSelections: 1,
        maxSelections: 1,
        productIds: ['foreign-product'],
      }),
    ).rejects.toBeInstanceOf(ComboChoiceProductNotFoundError);
    expect(mocks.createGroup).not.toHaveBeenCalled();
  });

  it('removes an included product by relation id scoped to the combo', async () => {
    mocks.includedFindFirst.mockResolvedValue({ id: 'included-link-1' });
    mocks.includedDelete.mockResolvedValue({ id: 'included-link-1' });
    const repository = new PrismaComboOptionRepository(prismaMock);

    await expect(repository.removeIncludedProduct('owner-1', 'combo-1', 'included-link-1')).resolves.toBe(true);
    expect(mocks.includedFindFirst).toHaveBeenCalledWith({
      where: { id: 'included-link-1', comboProductId: 'combo-1' },
      select: { id: true },
    });
    expect(mocks.includedDelete).toHaveBeenCalledWith({ where: { id: 'included-link-1' } });
  });
});
