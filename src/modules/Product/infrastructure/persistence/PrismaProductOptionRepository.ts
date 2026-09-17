import { Prisma, PrismaClient } from '@prisma/client';
import { assertOptionGroupConfiguration } from '../../domain/entities/ProductOptionGroup.js';
import { assertOptionPrice } from '../../domain/entities/ProductOption.js';
import { ProductOptionGroupProps, ProductOptionProps } from '../../domain/entities/Product.js';
import {
  InvalidOptionGroupOrderError,
  InvalidOptionOrderError,
  OptionGroupNotFoundError,
  OptionProductNotFoundError,
} from '../../domain/errors/ProductOptionErrors.js';
import {
  CreateOptionGroupRepositoryInput,
  CreateOptionRepositoryInput,
  ProductOptionRepository,
  UpdateOptionGroupRepositoryInput,
  UpdateOptionRepositoryInput,
} from '../../domain/ports/ProductOptionRepository.js';

const optionSelect = {
  id: true,
  optionGroupId: true,
  name: true,
  price: true,
  isAvailable: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
} as const;
const groupSelect = {
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
  options: { orderBy: { sortOrder: 'asc' as const }, select: optionSelect },
} as const;

export class PrismaProductOptionRepository implements ProductOptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createGroup(input: CreateOptionGroupRepositoryInput): Promise<ProductOptionGroupProps> {
    assertOptionGroupConfiguration(input);
    await this.assertProduct(input.ownerUserId, input.productId);
    for (const option of input.options) assertOptionPrice(option.price);
    const row = await this.prisma.$transaction(async (transaction) => {
      const aggregate = await transaction.productOptionGroup.aggregate({
        where: { productId: input.productId },
        _max: { sortOrder: true },
      });
      const group = await transaction.productOptionGroup.create({
        data: {
          productId: input.productId,
          name: input.name,
          isRequired: input.isRequired,
          minSelections: input.minSelections,
          maxSelections: input.maxSelections,
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
          isActive: input.isActive,
        },
        select: { id: true },
      });
      for (const [sortOrder, option] of input.options.entries()) {
        await transaction.productOption.create({
          data: {
            optionGroupId: group.id,
            name: option.name,
            price: option.price,
            isAvailable: option.isAvailable,
            sortOrder,
          },
        });
      }
      return transaction.productOptionGroup.findUniqueOrThrow({
        where: { id: group.id },
        select: groupSelect,
      });
    });
    return toGroup(row);
  }

  async getGroup(ownerUserId: string, groupId: string): Promise<ProductOptionGroupProps | null> {
    const row = await this.prisma.productOptionGroup.findFirst({
      where: { id: groupId, product: { business: { users: { some: { id: ownerUserId } } } } },
      select: groupSelect,
    });
    return row ? toGroup(row) : null;
  }

  async listGroups(ownerUserId: string, productId: string): Promise<ProductOptionGroupProps[]> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, business: { users: { some: { id: ownerUserId } } } },
      select: { id: true },
    });
    if (!product) throw new OptionProductNotFoundError();
    const rows = await this.prisma.productOptionGroup.findMany({
      where: { productId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: groupSelect,
    });
    return rows.map(toGroup);
  }

  async updateGroup(
    ownerUserId: string,
    groupId: string,
    input: UpdateOptionGroupRepositoryInput,
  ): Promise<ProductOptionGroupProps | null> {
    const existing = await this.prisma.productOptionGroup.findFirst({
      where: { id: groupId, product: { business: { users: { some: { id: ownerUserId } } } } },
      select: { isRequired: true, minSelections: true, maxSelections: true },
    });
    if (!existing) return null;
    assertOptionGroupConfiguration({
      isRequired: input.isRequired ?? existing.isRequired,
      minSelections: input.minSelections ?? existing.minSelections,
      maxSelections: input.maxSelections ?? existing.maxSelections,
    });
    const row = await this.prisma.productOptionGroup.update({
      where: { id: groupId },
      data: input,
      select: groupSelect,
    });
    return toGroup(row);
  }

  async deleteGroup(ownerUserId: string, groupId: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const group = await transaction.productOptionGroup.findFirst({
        where: { id: groupId, product: { business: { users: { some: { id: ownerUserId } } } } },
        select: { id: true, productId: true },
      });
      if (!group) return false;
      await transaction.productOptionGroup.delete({ where: { id: group.id } });
      await normalizeGroups(transaction, group.productId);
      return true;
    });
  }

  async setGroupActive(
    ownerUserId: string,
    groupId: string,
    isActive: boolean,
  ): Promise<ProductOptionGroupProps | null> {
    const existing = await this.prisma.productOptionGroup.findFirst({
      where: { id: groupId, product: { business: { users: { some: { id: ownerUserId } } } } },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await this.prisma.productOptionGroup.update({
      where: { id: groupId },
      data: { isActive },
      select: groupSelect,
    });
    return toGroup(row);
  }

  async reorderGroups(
    ownerUserId: string,
    productId: string,
    groupIds: string[],
  ): Promise<ProductOptionGroupProps[]> {
    await this.assertProduct(ownerUserId, productId);
    if (new Set(groupIds).size !== groupIds.length) throw new InvalidOptionGroupOrderError();
    return this.prisma.$transaction(async (transaction) => {
      const groups = await transaction.productOptionGroup.findMany({
        where: { productId },
        select: { id: true },
      });
      const ids = new Set(groups.map((group) => group.id));
      if (ids.size !== groupIds.length || groupIds.some((id) => !ids.has(id)))
        throw new InvalidOptionGroupOrderError();
      for (const [sortOrder, id] of groupIds.entries())
        await transaction.productOptionGroup.update({ where: { id }, data: { sortOrder } });
      const rows = await transaction.productOptionGroup.findMany({
        where: { productId },
        orderBy: { sortOrder: 'asc' },
        select: groupSelect,
      });
      return rows.map(toGroup);
    });
  }

  async createOption(
    ownerUserId: string,
    groupId: string,
    input: CreateOptionRepositoryInput,
  ): Promise<ProductOptionProps> {
    assertOptionPrice(input.price);
    const group = await this.assertGroup(ownerUserId, groupId);
    const row = await this.prisma.$transaction(async (transaction) => {
      const aggregate = await transaction.productOption.aggregate({
        where: { optionGroupId: group.id },
        _max: { sortOrder: true },
      });
      return transaction.productOption.create({
        data: {
          optionGroupId: group.id,
          name: input.name,
          price: input.price,
          isAvailable: input.isAvailable,
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
        },
        select: optionSelect,
      });
    });
    return toOption(row);
  }

  async getOption(ownerUserId: string, optionId: string): Promise<ProductOptionProps | null> {
    const row = await this.prisma.productOption.findFirst({
      where: {
        id: optionId,
        optionGroup: { product: { business: { users: { some: { id: ownerUserId } } } } },
      },
      select: optionSelect,
    });
    return row ? toOption(row) : null;
  }

  async listOptions(ownerUserId: string, groupId: string): Promise<ProductOptionProps[]> {
    await this.assertGroup(ownerUserId, groupId);
    const rows = await this.prisma.productOption.findMany({
      where: { optionGroupId: groupId },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
      select: optionSelect,
    });
    return rows.map(toOption);
  }

  async updateOption(
    ownerUserId: string,
    optionId: string,
    input: UpdateOptionRepositoryInput,
  ): Promise<ProductOptionProps | null> {
    const existing = await this.prisma.productOption.findFirst({
      where: {
        id: optionId,
        optionGroup: { product: { business: { users: { some: { id: ownerUserId } } } } },
      },
      select: { id: true },
    });
    if (!existing) return null;
    if (input.price !== undefined) assertOptionPrice(input.price);
    const row = await this.prisma.productOption.update({
      where: { id: optionId },
      data: input,
      select: optionSelect,
    });
    return toOption(row);
  }

  async deleteOption(ownerUserId: string, optionId: string): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const option = await transaction.productOption.findFirst({
        where: {
          id: optionId,
          optionGroup: { product: { business: { users: { some: { id: ownerUserId } } } } },
        },
        select: { id: true, optionGroupId: true },
      });
      if (!option) return false;
      await transaction.productOption.delete({ where: { id: option.id } });
      await normalizeOptions(transaction, option.optionGroupId);
      return true;
    });
  }

  async setOptionAvailable(
    ownerUserId: string,
    optionId: string,
    isAvailable: boolean,
  ): Promise<ProductOptionProps | null> {
    const existing = await this.prisma.productOption.findFirst({
      where: {
        id: optionId,
        optionGroup: { product: { business: { users: { some: { id: ownerUserId } } } } },
      },
      select: { id: true },
    });
    if (!existing) return null;
    const row = await this.prisma.productOption.update({
      where: { id: optionId },
      data: { isAvailable },
      select: optionSelect,
    });
    return toOption(row);
  }

  async reorderOptions(
    ownerUserId: string,
    groupId: string,
    optionIds: string[],
  ): Promise<ProductOptionProps[]> {
    await this.assertGroup(ownerUserId, groupId);
    if (new Set(optionIds).size !== optionIds.length) throw new InvalidOptionOrderError();
    return this.prisma.$transaction(async (transaction) => {
      const options = await transaction.productOption.findMany({
        where: { optionGroupId: groupId },
        select: { id: true },
      });
      const ids = new Set(options.map((option) => option.id));
      if (ids.size !== optionIds.length || optionIds.some((id) => !ids.has(id)))
        throw new InvalidOptionOrderError();
      for (const [sortOrder, id] of optionIds.entries())
        await transaction.productOption.update({ where: { id }, data: { sortOrder } });
      const rows = await transaction.productOption.findMany({
        where: { optionGroupId: groupId },
        orderBy: { sortOrder: 'asc' },
        select: optionSelect,
      });
      return rows.map(toOption);
    });
  }

  private async assertProduct(ownerUserId: string, productId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, business: { users: { some: { id: ownerUserId } } } },
      select: { id: true },
    });
    if (!product) throw new OptionProductNotFoundError();
  }

  private async assertGroup(ownerUserId: string, groupId: string): Promise<{ id: string }> {
    const group = await this.prisma.productOptionGroup.findFirst({
      where: { id: groupId, product: { business: { users: { some: { id: ownerUserId } } } } },
      select: { id: true },
    });
    if (!group) throw new OptionGroupNotFoundError();
    return group;
  }
}

async function normalizeGroups(
  transaction: Prisma.TransactionClient,
  productId: string,
): Promise<void> {
  const groups = await transaction.productOptionGroup.findMany({
    where: { productId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  for (const [sortOrder, group] of groups.entries())
    await transaction.productOptionGroup.update({ where: { id: group.id }, data: { sortOrder } });
}

async function normalizeOptions(
  transaction: Prisma.TransactionClient,
  groupId: string,
): Promise<void> {
  const options = await transaction.productOption.findMany({
    where: { optionGroupId: groupId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  for (const [sortOrder, option] of options.entries())
    await transaction.productOption.update({ where: { id: option.id }, data: { sortOrder } });
}

function toOption(
  row: Prisma.ProductOptionGetPayload<{ select: typeof optionSelect }>,
): ProductOptionProps {
  return {
    id: row.id,
    optionGroupId: row.optionGroupId,
    name: row.name,
    price: row.price.toNumber(),
    isAvailable: row.isAvailable,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toGroup(
  row: Prisma.ProductOptionGroupGetPayload<{ select: typeof groupSelect }>,
): ProductOptionGroupProps {
  return {
    id: row.id,
    productId: row.productId,
    name: row.name,
    isRequired: row.isRequired,
    minSelections: row.minSelections,
    maxSelections: row.maxSelections,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    options: row.options.map(toOption),
  };
}
