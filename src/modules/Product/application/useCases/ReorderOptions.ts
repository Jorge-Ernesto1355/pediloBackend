import { ProductOptionProps } from '../../domain/entities/Product.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class ReorderOptions {
  constructor(private readonly repository: ProductOptionRepository) {}
  execute(
    ownerUserId: string,
    groupId: string,
    optionIds: string[],
  ): Promise<ProductOptionProps[]> {
    return this.repository.reorderOptions(ownerUserId, groupId, optionIds);
  }
}
