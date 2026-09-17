import { Prisma, PrismaClient } from '@prisma/client';
import {
  Product,
  ProductOptionGroupProps,
  ProductOptionProps,
  ProductProps,
} from '../../domain/entities/Product.js';
import {
  InvalidProductOrderError,
  ProductAccessDeniedError,
  ProductBusinessNotFoundError,
  ProductNotFoundError,
  ProductSameCategoryError,
  ProductTargetCategoryNotFoundError,
} from '../../domain/errors/ProductErrors.js';
import {
  CreateProductRepositoryInput,
  ProductListFilters,
  ProductRepository,
  UpdateProductRepositoryInput,
} from '../../domain/ports/ProductRepository.js';

const productSelect = {
  id: true,
  businessId: true,
  categoryId: true,
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  sortOrder: true,
  isAvailable: true,
  createdAt: true,
  updatedAt: true,
  optionGroups: {
    orderBy: { sortOrder: 'asc' as const },
    select: {
      id: true,
      productId: true,
      name: true,
      isRequired: true,
      minSelections: true,
      maxSelections: true,
      sortOrder: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
      options: {
        orderBy: { sortOrder: 'asc' as const },
        select: {
          id: true,
          optionGroupId: true,
          name: true,
          price: true,
          isAvailable: true,
          sortOrder: true,
          createdAt: true,
          updatedAt: true,
        },
      },
    },
  },
} as const;

export class PrismaProductRepository implements ProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(input: CreateProductRepositoryInput): Promise<Product> {
    await this.assertBusinessAccess(input.ownerUserId, input.businessId);
    await this.assertCategory(input.categoryId, input.businessId);

    const row = await this.prisma.$transaction(async (transaction) => {
      const aggregate = await transaction.product.aggregate({
        where: { categoryId: input.categoryId },
        _max: { sortOrder: true },
      });
      return transaction.product.create({
        data: {
          businessId: input.businessId,
          categoryId: input.categoryId,
          name: input.name,
          description: input.description,
          price: input.price,
          imageUrl: input.imageUrl,
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
        },
        select: productSelect,
      });
    });
    return toDomain(row);
  }

  async getById(ownerUserId: string, productId: string): Promise<Product | null> {
    const row = await this.prisma.product.findFirst({
      where: { id: productId, business: { users: { some: { id: ownerUserId } } } },
      select: productSelect,
    });
    return row ? toDomain(row) : null;
  }

  async list(ownerUserId: string, filters: ProductListFilters): Promise<Product[]> {
    if (filters.businessId) await this.assertBusinessAccess(ownerUserId, filters.businessId);
    const rows = await this.prisma.product.findMany({
      where: {
        ...(filters.businessId
          ? { businessId: filters.businessId }
          : { business: { users: { some: { id: ownerUserId } } } }),
        ...(filters.categoryId ? { categoryId: filters.categoryId } : {}),
        ...(filters.isAvailable === undefined ? {} : { isAvailable: filters.isAvailable }),
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: productSelect,
    });
    return rows.map(toDomain);
  }

  async update(
    ownerUserId: string,
    productId: string,
    input: UpdateProductRepositoryInput,
  ): Promise<Product | null> {
    return this.prisma.$transaction(async (transaction) => {
      const existing = await transaction.product.findFirst({
        where: { id: productId, business: { users: { some: { id: ownerUserId } } } },
        select: { id: true, categoryId: true },
      });
      if (!existing) return null;

      const { sortOrder, ...fields } = input;
      if (sortOrder === undefined) {
        const row = await transaction.product.update({
          where: { id: productId },
          data: fields,
          select: productSelect,
        });
        return toDomain(row);
      }

      const products = await transaction.product.findMany({
        where: { categoryId: existing.categoryId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: { id: true },
      });
      const remaining = products
        .filter((product) => product.id !== productId)
        .map((product) => product.id);
      remaining.splice(Math.min(Math.max(sortOrder, 0), remaining.length), 0, productId);
      await transaction.product.update({ where: { id: productId }, data: fields });
      for (const [newSortOrder, id] of remaining.entries()) {
        await transaction.product.update({ where: { id }, data: { sortOrder: newSortOrder } });
      }
      const row = await transaction.product.findUniqueOrThrow({
        where: { id: productId },
        select: productSelect,
      });
      return toDomain(row);
    });
  }

  async delete(ownerUserId: string, productId: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: productId, business: { users: { some: { id: ownerUserId } } } },
        select: { id: true, categoryId: true },
      });
      if (!product) return false;
      await transaction.product.delete({ where: { id: product.id } });
      await normalizeCategoryOrder(transaction, product.categoryId);
      return true;
    });
  }

  async setAvailable(
    ownerUserId: string,
    productId: string,
    isAvailable: boolean,
  ): Promise<Product | null> {
    const existing = await this.prisma.product.findFirst({
      where: { id: productId, business: { users: { some: { id: ownerUserId } } } },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await this.prisma.product.update({
      where: { id: productId },
      data: { isAvailable },
      select: productSelect,
    });
    return toDomain(row);
  }

  async moveToCategory(
    ownerUserId: string,
    productId: string,
    targetCategoryId: string,
  ): Promise<Product> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new ProductBusinessNotFoundError();
    const businessId = user.businessId;

    return this.prisma.$transaction(async (transaction) => {
      const product = await transaction.product.findFirst({
        where: { id: productId, businessId },
        select: { id: true, categoryId: true },
      });
      if (!product) throw new ProductNotFoundError();
      if (product.categoryId === targetCategoryId) throw new ProductSameCategoryError();

      const target = await transaction.category.findFirst({
        where: { id: targetCategoryId, businessId },
        select: { id: true },
      });
      if (!target) throw new ProductTargetCategoryNotFoundError();
      const aggregate = await transaction.product.aggregate({
        where: { categoryId: target.id },
        _max: { sortOrder: true },
      });
      await transaction.product.update({
        where: { id: product.id },
        data: { categoryId: target.id, sortOrder: (aggregate._max.sortOrder ?? -1) + 1 },
      });
      await normalizeCategoryOrder(transaction, product.categoryId);
      const row = await transaction.product.findUniqueOrThrow({
        where: { id: product.id },
        select: productSelect,
      });
      return toDomain(row);
    });
  }

  async reorder(ownerUserId: string, categoryId: string, productIds: string[]): Promise<Product[]> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new ProductBusinessNotFoundError();
    const businessId = user.businessId;
    if (new Set(productIds).size !== productIds.length) throw new InvalidProductOrderError();

    return this.prisma.$transaction(async (transaction) => {
      const category = await transaction.category.findFirst({
        where: { id: categoryId, businessId },
        select: { id: true },
      });
      if (!category) throw new ProductTargetCategoryNotFoundError();
      const products = await transaction.product.findMany({
        where: { categoryId },
        select: { id: true },
      });
      const ids = new Set(products.map((product) => product.id));
      if (ids.size !== productIds.length || productIds.some((id) => !ids.has(id)))
        throw new InvalidProductOrderError();
      for (const [sortOrder, id] of productIds.entries())
        await transaction.product.update({ where: { id }, data: { sortOrder } });
      const rows = await transaction.product.findMany({
        where: { categoryId },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
        select: productSelect,
      });
      return rows.map(toDomain);
    });
  }

  private async assertBusinessAccess(ownerUserId: string, businessId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: ownerUserId },
      select: { businessId: true },
    });
    if (!user?.businessId) throw new ProductBusinessNotFoundError();
    if (user.businessId !== businessId) throw new ProductAccessDeniedError();
  }

  private async assertCategory(categoryId: string, businessId: string): Promise<void> {
    const category = await this.prisma.category.findFirst({
      where: { id: categoryId, businessId },
      select: { id: true },
    });
    if (!category) throw new ProductTargetCategoryNotFoundError();
  }
}

async function normalizeCategoryOrder(
  transaction: Prisma.TransactionClient,
  categoryId: string,
): Promise<void> {
  const products = await transaction.product.findMany({
    where: { categoryId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  for (const [sortOrder, product] of products.entries())
    await transaction.product.update({ where: { id: product.id }, data: { sortOrder } });
}

function toDomain(row: Prisma.ProductGetPayload<{ select: typeof productSelect }>): Product {
  const props: ProductProps = {
    id: row.id,
    businessId: row.businessId,
    categoryId: row.categoryId,
    name: row.name,
    description: row.description,
    price: row.price.toNumber(),
    imageUrl: row.imageUrl,
    sortOrder: row.sortOrder,
    isAvailable: row.isAvailable,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    optionGroups: row.optionGroups.map((group): ProductOptionGroupProps => ({
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
      options: group.options.map((option): ProductOptionProps => ({
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
  };
  return Product.create(props);
}
