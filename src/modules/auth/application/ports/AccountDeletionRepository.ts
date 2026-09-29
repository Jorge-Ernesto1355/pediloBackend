export interface AccountDeletionAssets {
  businessImagePublicIds: string[];
  productImagePublicIds: string[];
}

export interface AccountDeletionRepository {
  deleteByUserId(userId: string): Promise<AccountDeletionAssets>;
}
