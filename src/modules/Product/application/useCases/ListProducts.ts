import { Product } from '../../domain/entities/Product.js';
import { ProductRepository, ProductListFilters } from '../../domain/ports/ProductRepository.js';

export class ListProducts {
  constructor(private readonly repository: ProductRepository) {}

  execute(ownerUserId: string, filters: ProductListFilters): Promise<Product[]> {
    return this.repository.list(ownerUserId, filters);
  }
}
