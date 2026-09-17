import { ProductOptionGroupProps } from '../../domain/entities/Product.js';
import { OptionGroupNotFoundError } from '../../domain/errors/ProductOptionErrors.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class SetOptionGroupActive {
  constructor(private readonly repository: ProductOptionRepository) {}
  async execute(
    ownerUserId: string,
    groupId: string,
    isActive: boolean,
  ): Promise<ProductOptionGroupProps> {
    const group = await this.repository.setGroupActive(ownerUserId, groupId, isActive);
    if (!group) throw new OptionGroupNotFoundError();
    return group;
  }
}
