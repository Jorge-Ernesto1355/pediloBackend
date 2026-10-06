import { describe, expect, it, vi } from 'vitest';
import { PrismaMenuRepository } from './PrismaMenuRepository.js';

const decimal = (value: number) => ({ toNumber: () => value });

function prismaWithMenu(rows: unknown[]) {
  return {
    menu: { findMany: vi.fn().mockResolvedValue(rows) },
    user: { findUnique: vi.fn() },
  } as never;
}

describe('PrismaMenuRepository catalog', () => {
  it('returns categories, products and product options in the menu aggregate', async () => {
    const prisma = prismaWithMenu([
      {
        id: 'menu-1',
        businessId: 'business-1',
        name: 'Lunch',
        description: null,
        isActive: true,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-01'),
        categories: [
          {
            id: 'category-1',
            name: 'Meals',
            description: null,
            sortOrder: 0,
            isActive: true,
            products: [
              {
                id: 'product-1',
                businessId: 'business-1',
                categoryId: 'category-1',
                name: 'Burger',
                description: 'Classic',
                price: decimal(120),
                imageUrl: null,
                imageBlurUrl: null,
                sortOrder: 0,
                isAvailable: true,
                createdAt: new Date('2026-01-01'),
                updatedAt: new Date('2026-01-01'),
                optionGroups: [
                  {
                    id: 'group-1',
                    productId: 'product-1',
                    name: 'Extras',
                    isRequired: false,
                    minSelections: 0,
                    maxSelections: 2,
                    sortOrder: 0,
                    isActive: true,
                    createdAt: new Date('2026-01-01'),
                    updatedAt: new Date('2026-01-01'),
                    options: [
                      {
                        id: 'option-1',
                        optionGroupId: 'group-1',
                        name: 'Cheese',
                        price: decimal(15),
                        sortOrder: 0,
                        isAvailable: true,
                        createdAt: new Date('2026-01-01'),
                        updatedAt: new Date('2026-01-01'),
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
    ]);

    const menus = await new PrismaMenuRepository(prisma).list('user-1');

    expect(menus[0]!.toJSON()).toMatchObject({
      businessId: 'business-1',
      categories: [
        {
          id: 'category-1',
          products: [
            {
              id: 'product-1',
              price: 120,
              isAvailable: true,
              optionGroups: [{ options: [{ id: 'option-1', price: 15, isAvailable: true }] }],
            },
          ],
        },
      ],
    });
  });

  it('filters the mine catalog by the authenticated user business', async () => {
    const prisma = prismaWithMenu([]) as { menu: { findMany: ReturnType<typeof vi.fn> } };

    await new PrismaMenuRepository(prisma as never).list('user-1');

    expect(prisma.menu.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { business: { users: { some: { id: 'user-1' } } } },
      }),
    );
  });
});
