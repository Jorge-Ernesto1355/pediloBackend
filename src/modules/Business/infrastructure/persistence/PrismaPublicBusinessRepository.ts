import { DiscountStatus, Prisma, PrismaClient } from '@prisma/client';
import {
  PublicBusinessCatalog,
  PublicDiscountPrice,
  PublicBusinessRepository,
} from '../../application/ports/PublicBusinessRepository.js';
import { resolveProductImageUrl } from '@/shared/images/product-image.js';
import { bestDiscountFor, formatLabel } from '@/modules/Discount/domain/pricing.js';

const catalogInclude = {
  businessSchedule: true,
  ubicationMaps: true,
  images: true,
  menus: {
    where: { isActive: true },
    orderBy: { createdAt: 'asc' as const },
    include: {
      categories: {
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' as const },
        include: {
          products: {
            where: { isAvailable: true },
            orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
            include: {
              comboIncludes: {
                orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
                include: { product: true },
              },
              comboOptionGroups: {
                orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
                include: {
                  products: {
                    where: { product: { isAvailable: true } },
                    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
                    include: { product: true },
                  },
                },
              },
              optionGroups: {
                where: { isActive: true },
                orderBy: { sortOrder: 'asc' as const },
                include: {
                  options: {
                    where: { isAvailable: true },
                    orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
                  },
                },
              },
              globalOptionGroups: {
                orderBy: { sortOrder: 'asc' as const },
                include: {
                  group: {
                    include: {
                      options: {
                        where: { isAvailable: true },
                        orderBy: [{ sortOrder: 'asc' as const }, { createdAt: 'asc' as const }],
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} satisfies Prisma.BusinessInclude;

export class PrismaPublicBusinessRepository implements PublicBusinessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getSlugByQrCodeToken(token: string): Promise<string | null> {
    const business = await this.prisma.business.findUnique({
      where: { qrCodeToken: token },
      select: { slug: true },
    });
    return business?.slug ?? null;
  }

  async getCatalogBySlug(slug: string): Promise<PublicBusinessCatalog | null> {
    let row = await this.prisma.business.findUnique({
      where: { slug },
      include: catalogInclude,
    });

    if (!row) {
      const historicalSlug = await this.prisma.businessSlugHistory.findUnique({
        where: { slug },
        select: { businessId: true },
      });
      if (historicalSlug) {
        row = await this.prisma.business.findUnique({
          where: { id: historicalSlug.businessId },
          include: catalogInclude,
        });
      }
    }

    if (!row) return null;

    const settings = await this.prisma.businessSettings.findUnique({
      where: { businessId: row.id },
      select: { whatsapp: true },
    });
    const paymentCardAvailable = Boolean(
      await this.prisma.restaurantPaymentCard.findFirst({ where: { businessId: row.id, isActive: true }, select: { id: true } }),
    );

    return {
      business: {
        id: row.id,
        name: row.name,
        slug: row.slug,
        description: row.description,
        logoUrl: row.logoUrl ?? row.images.find((image) => image.type === 'LOGO')?.url ?? null,
        logoBlurUrl:
          row.logoBlurUrl ?? row.images.find((image) => image.type === 'LOGO')?.blurUrl ?? null,
        coverUrl: row.coverUrl ?? row.images.find((image) => image.type === 'COVER')?.url ?? null,
        coverBlurUrl:
          row.coverBlurUrl ?? row.images.find((image) => image.type === 'COVER')?.blurUrl ?? null,
        ubication: row.ubication,
        whatsappNumber: settings?.whatsapp ?? null,
        paymentCardAvailable,
        payment_card_available: paymentCardAvailable,
        ubicationMaps: row.ubicationMaps
          ? {
              latitude: row.ubicationMaps.latitude.toNumber(),
              longitude: row.ubicationMaps.longitude.toNumber(),
            }
          : null,
        businessSchedule: row.businessSchedule
          ? {
              days: row.businessSchedule.days,
              openTime: row.businessSchedule.openTime,
              closeTime: row.businessSchedule.closeTime,
              isClosed: row.businessSchedule.isClosed,
            }
          : null,
      },
      menus: await Promise.all(
        row.menus.map(async (menu) => ({
          id: menu.id,
          businessId: menu.businessId,
          name: menu.name,
          description: menu.description,
          isActive: menu.isActive,
          createdAt: menu.createdAt,
          updatedAt: menu.updatedAt,
          categories: await Promise.all(
            menu.categories.map(async (category) => ({
              id: category.id,
              businessId: category.businessId,
              menuId: category.menuId,
              name: category.name,
              description: category.description,
              sortOrder: category.sortOrder,
              isActive: category.isActive,
              createdAt: category.createdAt,
              updatedAt: category.updatedAt,
                products: await Promise.all(
                category.products.map(async (product) => ({
                  id: product.id,
                  businessId: product.businessId,
                  categoryId: product.categoryId,
                  type: product.type,
                  name: product.name,
                  description: product.description,
                  price: product.price.toNumber(),
                  priceOriginal: product.price.toNumber(),
                  priceFinal: product.price.toNumber(),
                  price_original: product.price.toNumber(),
                  price_final: product.price.toNumber(),
                  discount: null,
                  imageUrl: await resolveProductImageUrl(product.imageUrl),
                  sortOrder: product.sortOrder,
                  isAvailable:
                    product.isAvailable &&
                    product.comboIncludes.every((included) => included.product.isAvailable) &&
                    product.comboOptionGroups.every(
                      (group) => group.products.length >= group.minSelections,
                    ),
                  createdAt: product.createdAt,
                  updatedAt: product.updatedAt,
                  includedProducts: await Promise.all(
                    product.comboIncludes.map(async (included) => ({
                      id: included.id,
                      productId: included.productId,
                      quantity: included.quantity,
                      sortOrder: included.sortOrder,
                      product: {
                        id: included.product.id,
                        name: included.product.name,
                        description: included.product.description,
                        price: included.product.price.toNumber(),
                        imageUrl: await resolveProductImageUrl(included.product.imageUrl),
                        categoryId: included.product.categoryId,
                        isAvailable: included.product.isAvailable,
                      },
                    })),
                  ),
                  comboOptionGroups: await Promise.all(
                    product.comboOptionGroups
                      .filter((group) => group.products.length >= group.minSelections)
                      .map(async (group) => ({
                        id: group.id,
                        comboProductId: group.comboProductId,
                        name: group.name,
                        minSelections: group.minSelections,
                        maxSelections: group.maxSelections,
                        sortOrder: group.sortOrder,
                        products: await Promise.all(
                          group.products.map(async (choice) => ({
                            id: choice.id,
                            productId: choice.productId,
                            sortOrder: choice.sortOrder,
                            product: {
                              id: choice.product.id,
                              name: choice.product.name,
                              description: choice.product.description,
                              price: choice.product.price.toNumber(),
                              imageUrl: await resolveProductImageUrl(choice.product.imageUrl),
                              categoryId: choice.product.categoryId,
                              isAvailable: choice.product.isAvailable,
                            },
                          })),
                        ),
                      })),
                  ),
                  optionGroups: [
                    ...product.optionGroups.map((group) => ({
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
                      minSelections: option.minSelections,
                      maxSelections: option.maxSelections,
                      sortOrder: option.sortOrder,
                      isAvailable: option.isAvailable,
                      createdAt: option.createdAt,
                      updatedAt: option.updatedAt,
                    })),
                    })),
                    ...(product.globalOptionGroups ?? [])
                      .filter((link) => link.group.isActive && !link.group.archivedAt)
                      .map((link) => ({
                        id: link.group.id,
                        productId: product.id,
                        name: link.group.name,
                        isRequired: link.group.isRequired,
                        minSelections: link.group.minSelections,
                        maxSelections: link.group.maxSelections,
                        sortOrder: link.sortOrder,
                        isActive: link.group.isActive,
                        createdAt: link.group.createdAt,
                        updatedAt: link.group.updatedAt,
                        options: link.group.options.map((option) => ({
                          id: option.id,
                          optionGroupId: option.groupId,
                          name: option.name,
                          price: option.price.toNumber(),
                          minSelections: option.minSelections,
                          maxSelections: option.maxSelections,
                          sortOrder: option.sortOrder,
                          isAvailable: option.isAvailable,
                          createdAt: option.createdAt,
                          updatedAt: option.updatedAt,
                        })),
                      })),
                  ].sort((a, b) => a.sortOrder - b.sortOrder),
                })),
              ),
            })),
          ),
        })),
      ),
    };
  }

  async getActiveDiscountsBySlug(slug: string): Promise<PublicDiscountPrice[] | null> {
    const catalog = await this.getCatalogBySlug(slug);
    if (!catalog) return null;

    const discounts = await this.prisma.discount.findMany({
      where: { businessId: catalog.business.id, status: DiscountStatus.ACTIVE, startsAt: { lte: new Date() }, endsAt: { gt: new Date() } },
      include: { products: true, categories: true, menus: true },
    });
    const pricingDiscounts = discounts.map((discount) => ({
      id: discount.id,
      name: discount.name,
      type: discount.type,
      value: Number(discount.value),
      startsAt: discount.startsAt,
      endsAt: discount.endsAt,
      createdAt: discount.createdAt,
      target: {
        scope: discount.scope,
        productIds: discount.products.map((item) => item.productId),
        categoryIds: discount.categories.map((item) => item.categoryId),
        menuIds: discount.menus.map((item) => item.menuId),
      },
    }));

    return catalog.menus.flatMap((menu) => menu.categories.flatMap((category) => category.products.map((product) => {
      const selected = bestDiscountFor({ id: product.id, price: product.price, categoryId: product.categoryId, menuId: menu.id }, pricingDiscounts, new Date());
      const finalPrice = selected?.type === 'PERCENT'
        ? Math.round(product.price * (100 - selected.value)) / 100
        : selected
          ? Math.max(0, Math.round((product.price - selected.value) * 100) / 100)
          : product.price;
      return {
        productId: product.id,
        priceOriginal: product.price,
        priceFinal: finalPrice,
        price_original: product.price,
        price_final: finalPrice,
        discount: selected ? { id: selected.id, name: selected.name ?? 'Descuento', type: selected.type, value: selected.value, label: formatLabel(selected), endsAt: selected.endsAt } : null,
      };
    })));
  }
}
