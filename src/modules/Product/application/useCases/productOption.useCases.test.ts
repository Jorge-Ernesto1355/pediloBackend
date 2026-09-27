import { describe, expect, it, vi } from 'vitest';
import { assertOptionGroupConfiguration } from '../../domain/entities/ProductOptionGroup.js';
import { InvalidOptionGroupConfigurationError } from '../../domain/errors/ProductOptionErrors.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';
import { CreateOptionGroup } from './CreateOptionGroup.js';
import { CreateOption } from './CreateOption.js';
import { DeleteOption } from './DeleteOption.js';
import { ReorderOptionGroups } from './ReorderOptionGroups.js';
import { ReorderOptions } from './ReorderOptions.js';
import { SetOptionAvailable } from './SetOptionAvailable.js';
import { SetOptionGroupActive } from './SetOptionGroupActive.js';
import { UpdateOption } from './UpdateOption.js';
import { UpdateOptionGroup } from './UpdateOptionGroup.js';

const group = {
  id: 'group-1',
  productId: 'product-1',
  name: 'Extras',
  isRequired: false,
  minSelections: 0,
  maxSelections: 5,
  sortOrder: 0,
  isActive: true,
  options: [],
  createdAt: new Date(),
  updatedAt: new Date(),
};
const option = {
  id: 'option-1',
  optionGroupId: 'group-1',
  name: 'Queso',
  price: 15,
  isAvailable: true,
  sortOrder: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
};

function repository(): ProductOptionRepository {
  return {
    createGroup: vi.fn().mockResolvedValue(group),
    getGroup: vi.fn().mockResolvedValue(group),
    listGroups: vi.fn().mockResolvedValue([group]),
    updateGroup: vi.fn().mockResolvedValue(group),
    deleteGroup: vi.fn().mockResolvedValue(true),
    setGroupActive: vi.fn().mockResolvedValue(group),
    reorderGroups: vi.fn().mockResolvedValue([group]),
    createOption: vi.fn().mockResolvedValue(option),
    getOption: vi.fn().mockResolvedValue(option),
    listOptions: vi.fn().mockResolvedValue([option]),
    updateOption: vi.fn().mockResolvedValue(option),
    deleteOption: vi.fn().mockResolvedValue(true),
    setOptionAvailable: vi.fn().mockResolvedValue(option),
    reorderOptions: vi.fn().mockResolvedValue([option]),
  };
}

describe('product option use cases', () => {
  it('rejects invalid required-group configuration', () => {
    expect(() =>
      assertOptionGroupConfiguration({ isRequired: true, minSelections: 0, maxSelections: 1 }),
    ).toThrow(InvalidOptionGroupConfigurationError);
    expect(() =>
      assertOptionGroupConfiguration({ isRequired: false, minSelections: 2, maxSelections: 1 }),
    ).toThrow(InvalidOptionGroupConfigurationError);
  });

  it('creates a group and its initial options as one repository operation', async () => {
    const repo = repository();
    await new CreateOptionGroup(repo).execute('user-1', 'product-1', {
      name: 'Extras',
      minSelections: 0,
      maxSelections: 3,
      options: [
        { name: 'Queso', price: 15 },
        { name: 'Tocino', price: 20 },
      ],
    });
    expect(repo.createGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerUserId: 'user-1',
        productId: 'product-1',
        name: 'Extras',
        minSelections: 0,
        maxSelections: 3,
        options: [
          { name: 'Queso', price: 15, isAvailable: true },
          { name: 'Tocino', price: 20, isAvailable: true },
        ],
      }),
    );
  });

  it('updates status, metadata and options through their dedicated operations', async () => {
    const repo = repository();
    await new UpdateOptionGroup(repo).execute('user-1', 'group-1', { name: 'Extras fríos' });
    await new UpdateOptionGroup(repo).execute('user-1', 'group-1', { isActive: false });
    await new SetOptionGroupActive(repo).execute('user-1', 'group-1', false);
    await new CreateOption(repo).execute('user-1', 'group-1', { name: 'Aguacate', price: 20 });
    await new UpdateOption(repo).execute('user-1', 'option-1', { price: 18 });
    await new SetOptionAvailable(repo).execute('user-1', 'option-1', false);
    expect(repo.updateGroup).toHaveBeenCalled();
    expect(repo.setGroupActive).toHaveBeenCalledWith('user-1', 'group-1', false);
    expect(repo.createOption).toHaveBeenCalled();
    expect(repo.updateOption).toHaveBeenCalledWith('user-1', 'option-1', { price: 18 });
    expect(repo.setOptionAvailable).toHaveBeenCalledWith('user-1', 'option-1', false);
  });

  it('delegates transactional reorder and option deletion operations', async () => {
    const repo = repository();
    await new ReorderOptionGroups(repo).execute('user-1', 'product-1', ['group-2', 'group-1']);
    await new ReorderOptions(repo).execute('user-1', 'group-1', ['option-2', 'option-1']);
    await new DeleteOption(repo).execute('user-1', 'option-1');
    expect(repo.reorderGroups).toHaveBeenCalledWith('user-1', 'product-1', ['group-2', 'group-1']);
    expect(repo.reorderOptions).toHaveBeenCalledWith('user-1', 'group-1', ['option-2', 'option-1']);
    expect(repo.deleteOption).toHaveBeenCalledWith('user-1', 'option-1');
  });
});
