import {
  ProductManagementRepository,
  ProductAnalyticsFilter,
} from '../ports/ProductManagementRepository.js';

export class GetBestSellingProducts {
  constructor(private readonly repository: ProductManagementRepository) {}
  execute(ownerUserId: string, filters: ProductAnalyticsFilter) {
    return this.repository.bestSelling(ownerUserId, filters);
  }
}

export class GetMostRequestedProducts {
  constructor(private readonly repository: ProductManagementRepository) {}
  execute(ownerUserId: string, filters: ProductAnalyticsFilter) {
    return this.repository.mostRequested(ownerUserId, filters);
  }
}
