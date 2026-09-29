import { describe, expect, it, vi } from 'vitest';
import { AccountDeletionRepository } from '../ports/AccountDeletionRepository.js';
import { DeleteAccount } from './DeleteAccount.js';

describe('DeleteAccount', () => {
  it('deletes stored business and product assets after removing the account data', async () => {
    const repository: AccountDeletionRepository = {
      deleteByUserId: vi.fn().mockResolvedValue({
        businessImagePublicIds: ['business/logo'],
        productImagePublicIds: ['product/image'],
      }),
    };
    const businessStorage = { delete: vi.fn().mockResolvedValue(undefined) };
    const productStorage = { delete: vi.fn().mockResolvedValue(undefined) };

    await new DeleteAccount(repository, businessStorage, productStorage).execute('user-1');

    expect(repository.deleteByUserId).toHaveBeenCalledWith('user-1');
    expect(businessStorage.delete).toHaveBeenCalledWith('business/logo');
    expect(productStorage.delete).toHaveBeenCalledWith('product/image');
  });

  it('does not fail the account deletion if Cloudinary cleanup fails', async () => {
    const repository: AccountDeletionRepository = {
      deleteByUserId: vi.fn().mockResolvedValue({
        businessImagePublicIds: ['business/logo'],
        productImagePublicIds: [],
      }),
    };
    const businessStorage = { delete: vi.fn().mockRejectedValue(new Error('Cloudinary offline')) };
    const productStorage = { delete: vi.fn().mockResolvedValue(undefined) };

    await expect(
      new DeleteAccount(repository, businessStorage, productStorage).execute('user-1'),
    ).resolves.toBeUndefined();
  });
});
