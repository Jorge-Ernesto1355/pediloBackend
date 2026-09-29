import { Prisma, PrismaClient } from '@prisma/client';
import {
  PublicBusinessCatalog,
  PublicBusinessRepository,
} from '../../application/ports/PublicBusinessRepository.js';

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
console.log("slug", slug)

    const row = await this.prisma.business.findUnique({
      where: { slug },
      include: catalogInclude,
    });
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
      menus: row.menus.map((menu) => ({
        id: menu.id,
        businessId: menu.businessId,
        name: menu.name,
        description: menu.description,
        isActive: menu.isActive,
        createdAt: menu.createdAt,
        updatedAt: menu.updatedAt,
        categories: menu.categories.map((category) => ({
          id: category.id,
          businessId: category.businessId,
          menuId: category.menuId,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: category.isActive,
          createdAt: category.createdAt,
          updatedAt: category.updatedAt,
          products: category.products.map((product) => ({
            id: product.id,
            businessId: product.businessId,
            categoryId: product.categoryId,
            name: product.name,
            description: product.description,
            price: product.price.toNumber(),
            imageUrl: product.imageUrl,
            sortOrder: product.sortOrder,
            isAvailable: product.isAvailable,
            createdAt: product.createdAt,
            updatedAt: product.updatedAt,
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
                sortOrder: option.sortOrder,
                isAvailable: option.isAvailable,
                createdAt: option.createdAt,
                updatedAt: option.updatedAt,
              })),
            })),
          })),
        })),
      })),
    };
  }
}
