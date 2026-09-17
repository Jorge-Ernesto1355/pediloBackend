import { Product } from '../../domain/entities/Product.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';

export class ReorderProducts {
  constructor(private readonly repository: ProductRepository) {}

  execute(ownerUserId: string, categoryId: string, productIds: string[]): Promise<Product[]> {
    return this.repository.reorder(ownerUserId, categoryId, productIds);
  }
}
