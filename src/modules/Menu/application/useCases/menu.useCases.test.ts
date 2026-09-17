import { describe, expect, it, vi } from 'vitest';
import { Menu } from '../../domain/entities/Menu.js';
import { MenuContainsProductsError } from '../../domain/errors/MenuErrors.js';
import { MenuRepository } from '../../domain/ports/MenuRepository.js';
import { CreateMenu } from './CreateMenu.js';
import { DeleteMenu } from './DeleteMenu.js';
import { UpdateMenu } from './UpdateMenu.js';

const menu = Menu.create({
  id: 'menu-1',
  businessId: 'business-1',
  name: 'Lunch',
  description: null,
  isActive: true,
  categories: [],
  createdAt: new Date(),
  updatedAt: new Date(),
});

function repository(overrides: Partial<MenuRepository> = {}): MenuRepository {
  return {
    create: vi.fn().mockResolvedValue(menu),
    getById: vi.fn().mockResolvedValue(menu),
    list: vi.fn().mockResolvedValue([menu]),
    update: vi.fn().mockResolvedValue(menu),
    delete: vi.fn().mockResolvedValue(true),
    setActive: vi.fn().mockResolvedValue(menu),
    ...overrides,
  };
}

describe('menu use cases', () => {
  it('creates a menu without categories', async () => {
    const repo = repository();
    await new CreateMenu(repo).execute('user-1', 'business-1', { name: 'Lunch' });
    expect(repo.create).toHaveBeenCalledWith({
      ownerUserId: 'user-1',
      businessId: 'business-1',
      name: 'Lunch',
    });
  });

  it('passes multiple categories to the transactional repository operation', async () => {
    const repo = repository();
    const categories = [{ name: 'Drinks' }, { name: 'Meals' }, { name: 'Desserts' }];
    await new CreateMenu(repo).execute('user-1', 'business-1', { name: 'Main', categories });
    expect(repo.create).toHaveBeenCalledWith({
      ownerUserId: 'user-1',
      businessId: 'business-1',
      name: 'Main',
      categories,
    });
  });

  it('updates only menu fields', async () => {
    const repo = repository();
    await new UpdateMenu(repo).execute('user-1', 'menu-1', { name: 'Dinner' });
    expect(repo.update).toHaveBeenCalledWith('user-1', 'menu-1', { name: 'Dinner' });
  });

  it('deletes an empty menu and propagates the product protection error', async () => {
    const repo = repository();
    await new DeleteMenu(repo).execute('user-1', 'menu-1');
    expect(repo.delete).toHaveBeenCalledWith('user-1', 'menu-1');

    const protectedRepo = repository({
      delete: vi.fn().mockRejectedValue(new MenuContainsProductsError()),
    });
    await expect(new DeleteMenu(protectedRepo).execute('user-1', 'menu-1')).rejects.toBeInstanceOf(
      MenuContainsProductsError,
    );
  });
});
