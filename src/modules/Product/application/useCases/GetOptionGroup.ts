import { ProductOptionGroupProps } from '../../domain/entities/Product.js';
import { OptionGroupNotFoundError } from '../../domain/errors/ProductOptionErrors.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class GetOptionGroup {
  constructor(private readonly repository: ProductOptionRepository) {}
  async execute(ownerUserId: string, groupId: string): Promise<ProductOptionGroupProps> {
    const group = await this.repository.getGroup(ownerUserId, groupId);
    if (!group) throw new OptionGroupNotFoundError();
    return group;
  }
}
