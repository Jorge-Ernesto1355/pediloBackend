import { describe, expect, it, vi } from 'vitest';
import { Product } from '../../domain/entities/Product.js';
import { ProductManagementRepository } from '../ports/ProductManagementRepository.js';
import { GetBestSellingProducts, GetMostRequestedProducts } from './GetProductAnalytics.js';
import { GetProductAnalyticsSummary } from './GetProductAnalyticsSummary.js';
import { GetProductStatistics } from './GetProductStatistics.js';
import { ListProductsAdmin } from './ListProductsAdmin.js';

const product = Product.create({
  id: 'product-1',
  businessId: 'business-1',
  categoryId: 'category-1',
  name: 'Pizza',
  description: null,
  price: 100,
  imageUrl: null,
  sortOrder: 0,
  isAvailable: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

function repository(): ProductManagementRepository {
  return {
    listAdmin: vi.fn().mockResolvedValue({ products: [product], total: 1 }),
    stats: vi.fn().mockResolvedValue({
      totalProducts: 1,
      activeProducts: 1,
      inactiveProducts: 0,
      productsWithoutCategory: 0,
      categoriesWithProducts: 1,
    }),
    bestSelling: vi
      .fn()
      .mockResolvedValue([
        { productId: 'product-1', name: 'Pizza', quantitySold: 10, ordersCount: 5, revenue: 1000 },
      ]),
    mostRequested: vi
      .fn()
      .mockResolvedValue([
        { productId: 'product-1', name: 'Pizza', ordersCount: 5, quantityRequested: 10 },
      ]),
  };
}

describe('product management use cases', () => {
  it('passes administrative filters to the repository', async () => {
    const repo = repository();
    const filters = {
      businessId: 'business-1',
      page: 1,
      limit: 20,
      sortBy: 'createdAt' as const,
      sortOrder: 'desc' as const,
      isAvailable: true,
      search: 'pizza',
    };
    await new ListProductsAdmin(repo).execute('user-1', filters);
    expect(repo.listAdmin).toHaveBeenCalledWith('user-1', filters);
  });

  it('combines catalog statistics and real sales rankings for the dashboard', async () => {
    const repo = repository();
    const stats = new GetProductStatistics(repo);
    const summary = await new GetProductAnalyticsSummary(
      stats,
      new GetBestSellingProducts(repo),
      new GetMostRequestedProducts(repo),
    ).execute('user-1', { businessId: 'business-1', limit: 10 });
    expect(summary.totalProducts).toBe(1);
    expect(summary.topSellingProducts[0]?.quantitySold).toBe(10);
    expect(summary.mostRequestedProducts[0]?.quantityRequested).toBe(10);
  });
});
