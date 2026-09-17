import { ProductOptionProps } from '../../domain/entities/Product.js';
import { OptionNotFoundError } from '../../domain/errors/ProductOptionErrors.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class SetOptionAvailable {
  constructor(private readonly repository: ProductOptionRepository) {}
  async execute(
    ownerUserId: string,
    optionId: string,
    isAvailable: boolean,
  ): Promise<ProductOptionProps> {
    const option = await this.repository.setOptionAvailable(ownerUserId, optionId, isAvailable);
    if (!option) throw new OptionNotFoundError();
    return option;
  }
}
