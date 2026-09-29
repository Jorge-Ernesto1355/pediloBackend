import { AccountDeletionRepository } from '../ports/AccountDeletionRepository.js';

export interface AccountAssetStorage {
  delete(publicId: string): Promise<void>;
}

export class DeleteAccount {
  constructor(
    private readonly repository: AccountDeletionRepository,
    private readonly businessImageStorage: AccountAssetStorage,
    private readonly productImageStorage: AccountAssetStorage,
  ) {}

  async execute(userId: string): Promise<void> {
    const assets = await this.repository.deleteByUserId(userId);

    await Promise.all([
      ...assets.businessImagePublicIds.map((publicId) =>
        this.businessImageStorage.delete(publicId).catch(() => undefined),
      ),
      ...assets.productImagePublicIds.map((publicId) =>
        this.productImageStorage.delete(publicId).catch(() => undefined),
      ),
    ]);
  }
}
