import {
  ProductManagementRepository,
  ProductStatistics,
} from '../ports/ProductManagementRepository.js';

export class GetProductStatistics {
  constructor(private readonly repository: ProductManagementRepository) {}
  execute(ownerUserId: string, businessId: string): Promise<ProductStatistics> {
    return this.repository.stats(ownerUserId, businessId);
  }
}
