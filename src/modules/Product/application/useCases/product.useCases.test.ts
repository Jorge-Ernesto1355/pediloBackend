import { describe, expect, it, vi } from 'vitest';
import { Product } from '../../domain/entities/Product.js';
import {
  ProductNotFoundError,
  ProductSameCategoryError,
} from '../../domain/errors/ProductErrors.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';
import { CreateProduct } from './CreateProduct.js';
import { DeleteProduct } from './DeleteProduct.js';
import { GetProduct } from './GetProduct.js';
import { ListProducts } from './ListProducts.js';
import { MoveProductToCategory } from './MoveProductToCategory.js';
import { ReorderProducts } from './ReorderProducts.js';
import { SetProductAvailable } from './SetProductAvailable.js';
import { UpdateProduct } from './UpdateProduct.js';

const product = Product.create({
  id: 'product-1',
  businessId: 'business-1',
  categoryId: 'category-1',
  name: 'Cola',
  description: null,
  price: 20,
  imageUrl: null,
  sortOrder: 0,
  isAvailable: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});
const movedProduct = Product.create({ ...product.toJSON(), categoryId: 'category-2' });

function repository(): ProductRepository {
  return {
    create: vi.fn().mockResolvedValue(product),
    getById: vi.fn().mockResolvedValue(product),
    list: vi.fn().mockResolvedValue([product]),
    update: vi.fn().mockResolvedValue(product),
    delete: vi.fn().mockResolvedValue(true),
    setAvailable: vi.fn().mockResolvedValue(product),
    moveToCategory: vi.fn().mockResolvedValue(product),
    reorder: vi.fn().mockResolvedValue([product]),
  };
}

describe('product use cases', () => {
  it('moves a product through the authenticated business repository', async () => {
    const repo = repository();
    vi.mocked(repo.moveToCategory).mockResolvedValue(movedProduct);
    const result = await new MoveProductToCategory(repo).execute(
      'user-1',
      'product-1',
      'category-2',
    );
    expect(repo.moveToCategory).toHaveBeenCalledWith('user-1', 'product-1', 'category-2');
    expect(result.toJSON().categoryId).toBe('category-2');
  });

  it('creates, gets, lists, updates and changes availability', async () => {
    const repo = repository();
    await new CreateProduct(repo).execute('user-1', 'business-1', {
      categoryId: 'category-1',
      name: 'Cola',
      price: 20,
    });
    await new GetProduct(repo).execute('user-1', 'product-1');
    await new ListProducts(repo).execute('user-1', { categoryId: 'category-1' });
    await new UpdateProduct(repo).execute('user-1', 'product-1', { name: 'Cola Zero' });
    await new SetProductAvailable(repo).execute('user-1', 'product-1', false);
    expect(repo.create).toHaveBeenCalled();
    expect(repo.getById).toHaveBeenCalledWith('user-1', 'product-1');
    expect(repo.list).toHaveBeenCalledWith('user-1', { categoryId: 'category-1' });
    expect(repo.update).toHaveBeenCalledWith('user-1', 'product-1', { name: 'Cola Zero' });
    expect(repo.setAvailable).toHaveBeenCalledWith('user-1', 'product-1', false);
  });

  it('deletes and reorders products', async () => {
    const repo = repository();
    await new DeleteProduct(repo).execute('user-1', 'product-1');
    await new ReorderProducts(repo).execute('user-1', 'category-1', ['product-1']);
    expect(repo.delete).toHaveBeenCalledWith('user-1', 'product-1');
    expect(repo.reorder).toHaveBeenCalledWith('user-1', 'category-1', ['product-1']);
  });

  it('propagates not-found and same-category business errors', async () => {
    const missing = repository();
    vi.mocked(missing.getById).mockResolvedValue(null);
    await expect(new GetProduct(missing).execute('user-1', 'missing')).rejects.toBeInstanceOf(
      ProductNotFoundError,
    );
    const sameCategory = repository();
    vi.mocked(sameCategory.moveToCategory).mockRejectedValue(new ProductSameCategoryError());
    await expect(
      new MoveProductToCategory(sameCategory).execute('user-1', 'product-1', 'category-1'),
    ).rejects.toBeInstanceOf(ProductSameCategoryError);
  });
});
