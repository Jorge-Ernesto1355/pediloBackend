import { Prisma, PrismaClient } from '@prisma/client';
import { Category, CategoryProps } from '../../domain/entities/Category.js';
import {
  CategoryBusinessAccessDeniedError,
  CategoryBusinessNotFoundError,
  CategoryContainsProductsError,
  CategoryMenuNotFoundError,
  CategoryNotFoundError,
  InvalidCategoryOrderError,
  SameCategoryError,
} from '../../domain/errors/CategoryErrors.js';
import {
  CategoryRepository,
  CreateCategoryRepositoryInput,
  ReorderCategoriesRepositoryInput,
  UpdateCategoryRepositoryInput,
} from '../../domain/ports/CategoryRepository.js';

const categorySelect = {
  id: true,
  businessId: true,
  menuId: true,
  name: true,
  description: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

export class PrismaCategoryRepository implements CategoryRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateCategoryRepositoryInput): Promise<Category> {
    await this.assertBusinessAccess(input.ownerUserId, input.businessId);
    await this.assertMenu(input.menuId, input.businessId);
    const row = await this.prisma.$transaction(async (transaction) => {
      const aggregate = await transaction.category.aggregate({
        where: { menuId: input.menuId },
        _max: { sortOrder: true },
      });
      return transaction.category.create({
        data: {
          businessId: input.businessId,
          menuId: input.menuId,
          name: input.name,
          description: input.description,
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
        },
        select: categorySelect,
      });
    });
    return toDomain(row);
  }

  async getById(ownerUserId: string, id: string): Promise<Category | null> {
    const row = await this.prisma.category.findFirst({
      where: { id, business: { users: { some: { id: ownerUserId } } } },
      select: categorySelect,
    });
    return row ? toDomain(row) : null;
  }

  async update(
    ownerUserId: string,
    id: string,
    input: UpdateCategoryRepositoryInput,
  ): Promise<Category | null> {
    const existing = await this.prisma.category.findFirst({
      where: { id, business: { users: { some: { id: ownerUserId } } } },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await this.prisma.category.update({
      where: { id },
      data: input,
      select: categorySelect,
    });
    return toDomain(row);
  }

  async delete(ownerUserId: string, id: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const category = await transaction.category.findFirst({
        where: { id, business: { users: { some: { id: ownerUserId } } } },
        select: { id: true, _count: { select: { products: true } } },
      });
      if (!category) return false;
      if (category._count.products > 0) throw new CategoryContainsProductsError();
      await transaction.category.delete({ where: { id } });
      return true;
    });
  }

  async setActive(ownerUserId: string, id: string, isActive: boolean): Promise<Category | null> {
    const existing = await this.prisma.category.findFirst({
      where: { id, business: { users: { some: { id: ownerUserId } } } },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await this.prisma.category.update({
      where: { id },
      data: { isActive },
      select: categorySelect,
    });
    return toDomain(row);
  }

  async reorder(
    ownerUserId: string,
    menuId: string,
    input: ReorderCategoriesRepositoryInput,
  ): Promise<Category[]> {
    await this.assertBusinessAccessForMenu(ownerUserId, menuId);
    if (new Set(input.categoryIds).size !== input.categoryIds.length)
      throw new InvalidCategoryOrderError();
    return this.prisma.$transaction(async (transaction) => {
      const categories = await transaction.category.findMany({
        where: { menuId, business: { users: { some: { id: ownerUserId } } } },
        select: { id: true },
      });
      const ids = new Set(categories.map((category) => category.id));
      if (
        categories.length !== input.categoryIds.length ||
        input.categoryIds.some((id) => !ids.has(id))
      )
        throw new InvalidCategoryOrderError();
      for (const [sortOrder, id] of input.categoryIds.entries())
        await transaction.category.update({ where: { id }, data: { sortOrder } });
      const rows = await transaction.category.findMany({
        where: { menuId },
        orderBy: { sortOrder: 'asc' },
        select: categorySelect,
      });
      return rows.map(toDomain);
    });
  }

  async moveAllAndDelete(
    ownerUserId: string,
    sourceCategoryId: string,
    targetCategoryId: string,
  ): Promise<void> {
    if (sourceCategoryId === targetCategoryId) throw new SameCategoryError();
    await this.prisma.$transaction(async (transaction) => {
      const source = await transaction.category.findFirst({
        where: { id: sourceCategoryId, business: { users: { some: { id: ownerUserId } } } },
        select: {
          id: true,
          businessId: true,
          products: {
            orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
            select: { id: true },
          },
        },
      });
      if (!source) throw new CategoryNotFoundError();
      const target = await transaction.category.findFirst({
        where: { id: targetCategoryId, businessId: source.businessId },
        select: { id: true },
      });
      if (!target) throw new CategoryMenuNotFoundError();
      for (const [sortOrder, product] of source.products.entries())
        await transaction.product.update({
          where: { id: product.id },
          data: { categoryId: target.id, sortOrder },
        });
      await transaction.category.delete({ where: { id: source.id } });
    });
  }

  private async assertBusinessAccess(ownerUserId: string, businessId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new CategoryBusinessNotFoundError();
    if (user.businessId !== businessId) throw new CategoryBusinessAccessDeniedError();
  }

  private async assertMenu(menuId: string, businessId: string): Promise<void> {
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, businessId },
      select: { id: true },
    });
    if (!menu) throw new CategoryMenuNotFoundError();
  }

  private async assertBusinessAccessForMenu(ownerUserId: string, menuId: string): Promise<void> {
    const menu = await this.prisma.menu.findFirst({
      where: { id: menuId, business: { users: { some: { id: ownerUserId } } } },
      select: { id: true },
    });
    if (!menu) throw new CategoryMenuNotFoundError();
  }
}

function toDomain(row: Prisma.CategoryGetPayload<{ select: typeof categorySelect }>): Category {
  const props: CategoryProps = {
    id: row.id,
    businessId: row.businessId,
    menuId: row.menuId,
    name: row.name,
    description: row.description,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
  return Category.create(props);
}
