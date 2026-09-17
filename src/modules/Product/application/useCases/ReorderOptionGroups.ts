import { ProductOptionGroupProps } from '../../domain/entities/Product.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class ReorderOptionGroups {
  constructor(private readonly repository: ProductOptionRepository) {}
  execute(
    ownerUserId: string,
    productId: string,
    groupIds: string[],
  ): Promise<ProductOptionGroupProps[]> {
    return this.repository.reorderGroups(ownerUserId, productId, groupIds);
  }
}
