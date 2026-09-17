import { Product } from '../../domain/entities/Product.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';

export class MoveProductToCategory {
  constructor(private readonly repository: ProductRepository) {}

  execute(ownerUserId: string, productId: string, targetCategoryId: string): Promise<Product> {
    return this.repository.moveToCategory(ownerUserId, productId, targetCategoryId);
  }
}
