import { ProductOptionProps } from '../../domain/entities/Product.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class ListOptions {
  constructor(private readonly repository: ProductOptionRepository) {}
  execute(ownerUserId: string, groupId: string): Promise<ProductOptionProps[]> {
    return this.repository.listOptions(ownerUserId, groupId);
  }
}
