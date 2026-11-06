import { Prisma, PrismaClient } from '@prisma/client';
import {
  ComboChoiceProductNotFoundError,
  ComboChoiceProductNotInGroupError,
  ComboOptionGroupNotFoundError,
  ComboProductNotFoundError,
  DuplicateComboChoiceProductError,
  InvalidComboSelectionConfigurationError,
} from '../../domain/errors/ComboOptionErrors.js';
import {
  ComboOptionGroupView,
  ComboOptionProductView,
  ComboOptionRepository,
  ComboIncludedProductView,
  ComboProductView,
  CreateComboOptionGroupInput,
  UpdateComboOptionGroupInput,
} from '../../application/ports/ComboOptionRepository.js';

const choiceProductSelect = {
  id: true,
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  categoryId: true,
  isAvailable: true,
  category: { select: { id: true, name: true, menuId: true } },
} as const;

const groupSelect = {
  id: true,
  businessId: true,
  comboProductId: true,
  name: true,
  minSelections: true,
  maxSelections: true,
  sortOrder: true,
  createdAt: true,
  updatedAt: true,
  products: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      productId: true,
      sortOrder: true,
      product: { select: choiceProductSelect },
    },
  },
} satisfies Prisma.ComboOptionGroupSelect;

const comboSelect = {
  id: true,
  type: true,
  businessId: true,
  categoryId: true,
  name: true,
  description: true,
  price: true,
  imageUrl: true,
  isAvailable: true,
  category: { select: { id: true, name: true, menuId: true } },
  comboIncludes: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: {
      id: true,
      productId: true,
      quantity: true,
      sortOrder: true,
      product: { select: choiceProductSelect },
    },
  },
  comboOptionGroups: {
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }],
    select: groupSelect,
  },
} satisfies Prisma.ProductSelect;

export class PrismaComboOptionRepository implements ComboOptionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async createGroup(
    ownerUserId: string,
    comboProductId: string,
    input: CreateComboOptionGroupInput,
  ): Promise<ComboOptionGroupView> {
    const combo = await this.findCombo(ownerUserId, comboProductId);
    validateBounds(input.minSelections, input.maxSelections, input.productIds.length);
    await this.assertChoiceProducts(combo.businessId, input.productIds);

    return this.prisma.$transaction(async (transaction) => {
      const aggregate = await transaction.comboOptionGroup.aggregate({
        where: { comboProductId },
        _max: { sortOrder: true },
      });
      const row = await transaction.comboOptionGroup.create({
        data: {
          businessId: combo.businessId,
          comboProductId,
          name: input.name,
          minSelections: input.minSelections,
          maxSelections: input.maxSelections,
          sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
          products: {
            create: input.productIds.map((productId, sortOrder) => ({ productId, sortOrder })),
          },
        },
        select: groupSelect,
      });
      return toGroup(row);
    });
  }

  async getCombo(ownerUserId: string, comboProductId: string): Promise<ComboProductView | null> {
    const row = await this.prisma.product.findFirst({
      where: {
        id: comboProductId,
        type: 'COMBO',
        business: { users: { some: { id: ownerUserId } } },
      },
      select: comboSelect,
    });
    if (!row) return null;
    return {
      id: row.id,
      businessId: row.businessId,
      categoryId: row.categoryId,
      type: 'COMBO',
      name: row.name,
      description: row.description,
      price: row.price.toNumber(),
      imageUrl: row.imageUrl,
      isAvailable: row.isAvailable,
      category: row.category,
      optionGroups: row.comboOptionGroups.map(toGroup),
      includedProducts: row.comboIncludes.map(toIncludedProduct),
    };
  }

  async updateGroup(
    ownerUserId: string,
    comboProductId: string,
    groupId: string,
    input: UpdateComboOptionGroupInput,
  ): Promise<ComboOptionGroupView | null> {
    const existing = await this.prisma.comboOptionGroup.findFirst({
      where: {
        id: groupId,
        comboProductId,
        comboProduct: { business: { users: { some: { id: ownerUserId } } } },
      },
      select: { minSelections: true, maxSelections: true, products: { select: { id: true } } },
    });
    if (!existing) return null;
    const minSelections = input.minSelections ?? existing.minSelections;
    const maxSelections = input.maxSelections ?? existing.maxSelections;
    validateBounds(minSelections, maxSelections, existing.products.length);
    const row = await this.prisma.comboOptionGroup.update({
      where: { id: groupId },
      data: input,
      select: groupSelect,
    });
    return toGroup(row);
  }

  async addProduct(
    ownerUserId: string,
    comboProductId: string,
    groupId: string,
    productId: string,
  ): Promise<ComboOptionProductView> {
    const group = await this.findGroup(ownerUserId, comboProductId, groupId);
    const choiceCount = await this.prisma.comboOptionProduct.count({
      where: { optionGroupId: groupId },
    });
    if (choiceCount >= 5) throw new InvalidComboSelectionConfigurationError();
    await this.assertChoiceProducts(group.businessId, [productId]);
    const alreadyLinked = await this.prisma.product.findFirst({
      where: {
        id: comboProductId,
        OR: [
          { comboIncludes: { some: { productId } } },
          { comboOptionGroups: { some: { products: { some: { productId } } } } },
        ],
      },
      select: { id: true },
    });
    if (alreadyLinked) throw new DuplicateComboChoiceProductError();
    const exists = await this.prisma.comboOptionProduct.findUnique({
      where: { optionGroupId_productId: { optionGroupId: groupId, productId } },
      select: { id: true },
    });
    if (exists) throw new DuplicateComboChoiceProductError();
    const aggregate = await this.prisma.comboOptionProduct.aggregate({
      where: { optionGroupId: groupId },
      _max: { sortOrder: true },
    });
    const row = await this.prisma.comboOptionProduct.create({
      data: { optionGroupId: groupId, productId, sortOrder: (aggregate._max.sortOrder ?? -1) + 1 },
      select: {
        id: true,
        productId: true,
        sortOrder: true,
        product: { select: choiceProductSelect },
      },
    });
    return toChoice(row);
  }

  async removeProduct(
    ownerUserId: string,
    comboProductId: string,
    groupId: string,
    productId: string,
  ): Promise<boolean> {
    return this.prisma.$transaction(async (transaction) => {
      const group = await transaction.comboOptionGroup.findFirst({
        where: {
          id: groupId,
          comboProductId,
          comboProduct: { business: { users: { some: { id: ownerUserId } } } },
        },
        select: {
          minSelections: true,
          maxSelections: true,
          products: { select: { id: true } },
        },
      });
      if (!group) return false;
      const choice = await transaction.comboOptionProduct.findUnique({
        where: { optionGroupId_productId: { optionGroupId: groupId, productId } },
        select: { id: true },
      });
      if (!choice) throw new ComboChoiceProductNotInGroupError();
      if (group.products.length - 1 < group.maxSelections)
        throw new InvalidComboSelectionConfigurationError();
      await transaction.comboOptionProduct.delete({ where: { id: choice.id } });
      return true;
    });
  }

  async deleteGroup(
    ownerUserId: string,
    comboProductId: string,
    groupId: string,
  ): Promise<boolean> {
    const group = await this.prisma.comboOptionGroup.findFirst({
      where: {
        id: groupId,
        comboProductId,
        comboProduct: { business: { users: { some: { id: ownerUserId } } } },
      },
      select: { id: true },
    });
    if (!group) return false;
    await this.prisma.comboOptionGroup.delete({ where: { id: group.id } });
    return true;
  }

  async addIncludedProduct(
    ownerUserId: string,
    comboProductId: string,
    productId: string,
  ): Promise<ComboIncludedProductView> {
    const combo = await this.findCombo(ownerUserId, comboProductId);
    if (productId === comboProductId) throw new ComboChoiceProductNotFoundError();
    await this.assertChoiceProducts(combo.businessId, [productId]);
    const alreadyOptional = await this.prisma.comboOptionProduct.findFirst({
      where: { productId, optionGroup: { comboProductId } },
      select: { id: true },
    });
    if (alreadyOptional) throw new DuplicateComboChoiceProductError();
    const exists = await this.prisma.comboIncludedProduct.findUnique({
      where: { comboProductId_productId: { comboProductId, productId } },
      select: { id: true },
    });
    if (exists) throw new DuplicateComboChoiceProductError();
    const aggregate = await this.prisma.comboIncludedProduct.aggregate({
      where: { comboProductId },
      _max: { sortOrder: true },
    });
    const row = await this.prisma.comboIncludedProduct.create({
      data: {
        businessId: combo.businessId,
        comboProductId,
        productId,
        sortOrder: (aggregate._max.sortOrder ?? -1) + 1,
      },
      select: {
        id: true,
        productId: true,
        quantity: true,
        sortOrder: true,
        product: { select: choiceProductSelect },
      },
    });
    return toIncludedProduct(row);
  }

  async removeIncludedProduct(
    ownerUserId: string,
    comboProductId: string,
    includedProductId: string,
  ): Promise<boolean> {
    await this.findCombo(ownerUserId, comboProductId);
    const included = await this.prisma.comboIncludedProduct.findFirst({
      where: { id: includedProductId, comboProductId },
      select: { id: true },
    });
    if (!included) return false;
    await this.prisma.comboIncludedProduct.delete({ where: { id: included.id } });
    return true;
  }

  async updateIncludedProductQuantity(
    ownerUserId: string,
    comboProductId: string,
    includedProductId: string,
    quantity: number,
  ): Promise<ComboIncludedProductView | null> {
    await this.findCombo(ownerUserId, comboProductId);
    const included = await this.prisma.comboIncludedProduct.findFirst({
      where: { id: includedProductId, comboProductId },
      select: { id: true },
    });
    if (!included) return null;
    const row = await this.prisma.comboIncludedProduct.update({
      where: { id: included.id },
      data: { quantity },
      select: {
        id: true,
        productId: true,
        quantity: true,
        sortOrder: true,
        product: { select: choiceProductSelect },
      },
    });
    return toIncludedProduct(row);
  }

  private async findCombo(ownerUserId: string, productId: string) {
    const combo = await this.prisma.product.findFirst({
      where: { id: productId, type: 'COMBO', business: { users: { some: { id: ownerUserId } } } },
      select: { id: true, businessId: true },
    });
    if (!combo) throw new ComboProductNotFoundError();
    return combo;
  }

  private async findGroup(ownerUserId: string, productId: string, groupId: string) {
    const group = await this.prisma.comboOptionGroup.findFirst({
      where: {
        id: groupId,
        comboProductId: productId,
        comboProduct: { business: { users: { some: { id: ownerUserId } } } },
      },
      select: { id: true, businessId: true },
    });
    if (!group) throw new ComboOptionGroupNotFoundError();
    return group;
  }

  private async assertChoiceProducts(businessId: string, productIds: string[]) {
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, businessId, type: 'PRODUCT' },
      select: { id: true },
    });
    if (products.length !== productIds.length) throw new ComboChoiceProductNotFoundError();
  }
}

function validateBounds(minSelections: number, maxSelections: number, productCount: number) {
  if (
    !Number.isInteger(minSelections) ||
    !Number.isInteger(maxSelections) ||
    minSelections < 0 ||
    maxSelections < 1 ||
    maxSelections < minSelections ||
    maxSelections > 100 ||
    maxSelections > productCount
  ) {
    throw new InvalidComboSelectionConfigurationError();
  }
}

function toGroup(
  row: Prisma.ComboOptionGroupGetPayload<{ select: typeof groupSelect }>,
): ComboOptionGroupView {
  return {
    ...row,
    products: row.products.map(toChoice),
  };
}

function toChoice(
  row: Prisma.ComboOptionProductGetPayload<{
    select: {
      id: true;
      productId: true;
      sortOrder: true;
      product: { select: typeof choiceProductSelect };
    };
  }>,
): ComboOptionProductView {
  return {
    id: row.id,
    productId: row.productId,
    sortOrder: row.sortOrder,
    product: { ...row.product, price: row.product.price.toNumber() },
  };
}

function toIncludedProduct(
  row: Prisma.ComboIncludedProductGetPayload<{
    select: {
      id: true;
      productId: true;
      quantity: true;
      sortOrder: true;
      product: { select: typeof choiceProductSelect };
    };
  }>,
): ComboIncludedProductView {
  return {
    id: row.id,
    productId: row.productId,
    quantity: row.quantity,
    sortOrder: row.sortOrder,
    product: { ...row.product, price: row.product.price.toNumber() },
  };
}
