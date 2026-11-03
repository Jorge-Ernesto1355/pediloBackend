import { Prisma, PrismaClient } from '@prisma/client';
import {
  PublicBusinessCatalog,
  PublicBusinessRepository,
} from '../../application/ports/PublicBusinessRepository.js';
import { resolveProductImageUrl } from '@/shared/images/product-image.js';

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
            },
          },
        },
      },
    },
  },
} satisfies Prisma.BusinessInclude;

export class PrismaPublicBusinessRepository implements PublicBusinessRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async getCatalogBySlug(slug: string): Promise<PublicBusinessCatalog | null> {
    console.log('slug', slug);

    const row = await this.prisma.business.findUnique({
      where: { slug },
      include: catalogInclude,
    });

    console.log(slug);
    if (!row) return null;

    const settings = await this.prisma.businessSettings.findUnique({
      where: { businessId: row.id },
      select: { whatsapp: true },
    });

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
                  optionGroups: product.optionGroups.map((group) => ({
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
                })),
              ),
            })),
          ),
        })),
      ),
    };
  }
}
