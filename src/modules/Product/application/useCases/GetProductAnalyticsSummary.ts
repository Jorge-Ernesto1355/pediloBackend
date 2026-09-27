import { GetProductStatistics } from './GetProductStatistics.js';
import { GetBestSellingProducts, GetMostRequestedProducts } from './GetProductAnalytics.js';
import { ProductAnalyticsFilter } from '../ports/ProductManagementRepository.js';

export class GetProductAnalyticsSummary {
  constructor(
    private readonly statistics: GetProductStatistics,
    private readonly bestSelling: GetBestSellingProducts,
    private readonly mostRequested: GetMostRequestedProducts,
  ) {}

  async execute(ownerUserId: string, filters: ProductAnalyticsFilter) {
    const [stats, topSellingProducts, mostRequestedProducts] = await Promise.all([
      this.statistics.execute(ownerUserId, filters.businessId),
      this.bestSelling.execute(ownerUserId, filters),
      this.mostRequested.execute(ownerUserId, filters),
    ]);
    return { ...stats, topSellingProducts, mostRequestedProducts };
  }
}
