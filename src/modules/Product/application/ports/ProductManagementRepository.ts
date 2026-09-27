import { Product } from '../../domain/entities/Product.js';

export type ProductSortBy = 'name' | 'price' | 'createdAt' | 'updatedAt' | 'sortOrder';
export type ProductSortOrder = 'asc' | 'desc';

export interface ProductManagementFilters {
  businessId: string;
  categoryId?: string;
  isAvailable?: boolean;
  search?: string;
  createdFrom?: Date;
  createdTo?: Date;
  updatedFrom?: Date;
  updatedTo?: Date;
  page: number;
  limit: number;
  sortBy: ProductSortBy;
  sortOrder: ProductSortOrder;
}

export interface ProductStatistics {
  totalProducts: number;
  activeProducts: number;
  inactiveProducts: number;
  productsWithoutCategory: number;
  categoriesWithProducts: number;
}

export interface ProductAnalyticsFilter {
  businessId: string;
  from?: Date;
  to?: Date;
  categoryId?: string;
  limit: number;
}

export interface BestSellingProduct {
  productId: string;
  name: string;
  quantitySold: number;
  ordersCount: number;
  revenue: number;
}

export interface MostRequestedProduct {
  productId: string;
  name: string;
  ordersCount: number;
  quantityRequested: number;
}

export interface ProductManagementRepository {
  listAdmin(
    ownerUserId: string,
    filters: ProductManagementFilters,
  ): Promise<{ products: Product[]; total: number }>;
  stats(ownerUserId: string, businessId: string): Promise<ProductStatistics>;
  bestSelling(ownerUserId: string, filters: ProductAnalyticsFilter): Promise<BestSellingProduct[]>;
  mostRequested(
    ownerUserId: string,
    filters: ProductAnalyticsFilter,
  ): Promise<MostRequestedProduct[]>;
}
