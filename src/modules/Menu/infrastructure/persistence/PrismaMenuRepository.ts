import { Prisma, PrismaClient } from '@prisma/client';
import {
  Menu,
  MenuCategorySummary,
  MenuProduct,
  MenuProductOptionGroup,
  MenuProps,
} from '../../domain/entities/Menu.js';
import {
  MenuAccessDeniedError,
  MenuBusinessNotFoundError,
  MenuContainsProductsError,
} from '../../domain/errors/MenuErrors.js';
import {
  CreateMenuRepositoryInput,
  MenuRepository,
  UpdateMenuRepositoryInput,
} from '../../domain/ports/MenuRepository.js';

const menuInclude = {
  categories: {
    orderBy: { sortOrder: 'asc' },
    include: {
      products: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        include: {
          optionGroups: {
            orderBy: { sortOrder: 'asc' },
            include: {
              options: { orderBy: { sortOrder: 'asc' } },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.MenuInclude;

export class PrismaMenuRepository implements MenuRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateMenuRepositoryInput): Promise<Menu> {
    await this.assertBusinessAccess(input.ownerUserId, input.businessId);

    const row = await this.prisma.$transaction(async (transaction) => {
      const menu = await transaction.menu.create({
        data: {
          businessId: input.businessId,
          name: input.name,
          description: input.description,
          isActive: input.isActive ?? true,
        },
      });

      for (const [sortOrder, category] of (input.categories ?? []).entries()) {
        await transaction.category.create({
          data: {
            businessId: input.businessId,
            menuId: menu.id,
            name: category.name,
            description: category.description,
            sortOrder,
            isActive: category.isActive ?? true,
          },
        });
      }

      return transaction.menu.findUniqueOrThrow({ where: { id: menu.id }, include: menuInclude });
    });

    return toDomain(row);
  }

  async getById(ownerUserId: string, id: string): Promise<Menu | null> {
    const row = await this.prisma.menu.findFirst({
      where: { id, business: { users: { some: { id: ownerUserId } } } },
      include: menuInclude,
    });
    return row ? toDomain(row) : null;
  }

  async list(ownerUserId: string, businessId?: string): Promise<Menu[]> {
    if (businessId) await this.assertBusinessAccess(ownerUserId, businessId);
    const rows = await this.prisma.menu.findMany({
      where: businessId ? { businessId } : { business: { users: { some: { id: ownerUserId } } } },
      orderBy: { createdAt: 'asc' },
      include: menuInclude,
    });
    return rows.map(toDomain);
  }

  async update(
    ownerUserId: string,
    id: string,
    input: UpdateMenuRepositoryInput,
  ): Promise<Menu | null> {
    const existing = await this.prisma.menu.findFirst({
      where: { id, business: { users: { some: { id: ownerUserId } } } },
      select: { id: true },
    });
    if (!existing) return null;

    const row = await this.prisma.menu.update({
      where: { id },
      data: input,
      include: menuInclude,
    });
    return toDomain(row);
  }

  async delete(ownerUserId: string, id: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const menu = await transaction.menu.findFirst({
        where: { id, business: { users: { some: { id: ownerUserId } } } },
        select: {
          id: true,
          categories: { select: { _count: { select: { products: true } } } },
        },
      });
      if (!menu) return false;
      if (menu.categories.some((category) => category._count.products > 0)) {
        throw new MenuContainsProductsError();
      }

      await transaction.menu.delete({ where: { id } });
      return true;
    });
  }

  async setActive(ownerUserId: string, id: string, isActive: boolean): Promise<Menu | null> {
    const existing = await this.prisma.menu.findFirst({
      where: { id, business: { users: { some: { id: ownerUserId } } } },
      select: { id: true },
    });
    if (!existing) return null;

    const row = await this.prisma.menu.update({
      where: { id },
      data: { isActive },
      include: menuInclude,
    });
    return toDomain(row);
  }

  private async assertBusinessAccess(ownerUserId: string, businessId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new MenuBusinessNotFoundError();
    if (user.businessId !== businessId) throw new MenuAccessDeniedError();
  }
}

function toDomain(row: Prisma.MenuGetPayload<{ include: typeof menuInclude }>): Menu {
  const categories: MenuCategorySummary[] = row.categories.map((category) => ({
    id: category.id,
    name: category.name,
    description: category.description,
    sortOrder: category.sortOrder,
    isActive: category.isActive,
    products: category.products.map((product): MenuProduct => ({
      id: product.id,
      businessId: product.businessId,
      categoryId: product.categoryId,
      name: product.name,
      description: product.description,
      price: product.price.toNumber(),
      imageUrl: product.imageUrl,
      imageBlurUrl: product.imageBlurUrl,
      sortOrder: product.sortOrder,
      isAvailable: product.isAvailable,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      optionGroups: product.optionGroups.map((group): MenuProductOptionGroup => ({
        id: group.id,
        productId: group.productId,
        name: group.name,
        isRequired: group.isRequired,
        minSelections: group.minSelections,
        maxSelections: group.maxSelections,
        sortOrder: group.sortOrder,
        isActive: group.isActive,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt,
        options: group.options.map((option) => ({
          id: option.id,
          optionGroupId: option.optionGroupId,
          name: option.name,
          price: option.price.toNumber(),
          isAvailable: option.isAvailable,
          sortOrder: option.sortOrder,
          createdAt: option.createdAt,
          updatedAt: option.updatedAt,
        })),
      })),
    })),
  }));

  const props: MenuProps = {
    id: row.id,
    businessId: row.businessId,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    categories,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return Menu.create(props);
}
