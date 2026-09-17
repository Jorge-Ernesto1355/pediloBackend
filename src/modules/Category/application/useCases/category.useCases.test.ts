import { describe, expect, it, vi } from 'vitest';
import { Category } from '../../domain/entities/Category.js';
import {
  CategoryContainsProductsError,
  CategoryBusinessAccessDeniedError,
} from '../../domain/errors/CategoryErrors.js';
import { CategoryRepository } from '../../domain/ports/CategoryRepository.js';
import { CreateCategory } from './CreateCategory.js';
import { DeleteCategory } from './DeleteCategory.js';
import { MoveAllProductsAndDeleteCategory } from './MoveAllProductsAndDeleteCategory.js';
import { ReorderCategories } from './ReorderCategories.js';
import { UpdateCategory } from './UpdateCategory.js';

const category = Category.create({
  id: 'category-1',
  businessId: 'business-1',
  menuId: 'menu-1',
  name: 'Drinks',
  description: null,
  sortOrder: 0,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function repository(overrides: Partial<CategoryRepository> = {}): CategoryRepository {
  return {
    create: vi.fn().mockResolvedValue(category),
    getById: vi.fn().mockResolvedValue(category),
    update: vi.fn().mockResolvedValue(category),
    delete: vi.fn().mockResolvedValue(true),
    setActive: vi.fn().mockResolvedValue(category),
    reorder: vi.fn().mockResolvedValue([category]),
    moveAllAndDelete: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('category use cases', () => {
  it('creates a category without accepting a client sortOrder', async () => {
    const repo = repository();
    await new CreateCategory(repo).execute('user-1', 'business-1', {
      menuId: 'menu-1',
      name: 'Drinks',
    });
    expect(repo.create).toHaveBeenCalledWith({
      ownerUserId: 'user-1',
      businessId: 'business-1',
      menuId: 'menu-1',
      name: 'Drinks',
    });
  });

  it('updates category metadata without touching products', async () => {
    const repo = repository();
    await new UpdateCategory(repo).execute('user-1', 'category-1', { name: 'Cold drinks' });
    expect(repo.update).toHaveBeenCalledWith('user-1', 'category-1', { name: 'Cold drinks' });
    expect(repo).not.toHaveProperty('updateProducts');
  });

  it('deletes empty categories and rejects categories containing products', async () => {
    const repo = repository();
    await new DeleteCategory(repo).execute('user-1', 'category-1');
    const protectedRepo = repository({
      delete: vi.fn().mockRejectedValue(new CategoryContainsProductsError()),
    });
    await expect(
      new DeleteCategory(protectedRepo).execute('user-1', 'category-1'),
    ).rejects.toBeInstanceOf(CategoryContainsProductsError);
  });

  it('moves all products and deletes the source category as one repository operation', async () => {
    const repo = repository();
    await new MoveAllProductsAndDeleteCategory(repo).execute('user-1', 'category-1', 'category-2');
    expect(repo.moveAllAndDelete).toHaveBeenCalledWith('user-1', 'category-1', 'category-2');
  });

  it('reorders all categories in the requested menu', async () => {
    const repo = repository();
    await new ReorderCategories(repo).execute('user-1', 'menu-1', {
      categoryIds: ['category-2', 'category-1'],
    });
    expect(repo.reorder).toHaveBeenCalledWith('user-1', 'menu-1', {
      categoryIds: ['category-2', 'category-1'],
    });
  });

  it('does not bypass authorization errors from the repository', async () => {
    const repo = repository({
      create: vi.fn().mockRejectedValue(new CategoryBusinessAccessDeniedError()),
    });
    await expect(
      new CreateCategory(repo).execute('user-1', 'business-2', {
        menuId: 'menu-1',
        name: 'Drinks',
      }),
    ).rejects.toBeInstanceOf(CategoryBusinessAccessDeniedError);
  });
});
