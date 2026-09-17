import { ProductOptionGroupProps } from '../../domain/entities/Product.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class ListOptionGroups {
  constructor(private readonly repository: ProductOptionRepository) {}
  execute(ownerUserId: string, productId: string): Promise<ProductOptionGroupProps[]> {
    return this.repository.listGroups(ownerUserId, productId);
  }
}
