import { Prisma, PrismaClient } from '@prisma/client';
import { Menu, MenuCategorySummary, MenuProps } from '../../domain/entities/Menu.js';
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

const menuInclude = { categories: { orderBy: { sortOrder: 'asc' as const } } };

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
