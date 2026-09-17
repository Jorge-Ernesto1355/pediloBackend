import { ProductOptionProps } from '../../domain/entities/Product.js';
import { OptionNotFoundError } from '../../domain/errors/ProductOptionErrors.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class GetOption {
  constructor(private readonly repository: ProductOptionRepository) {}
  async execute(ownerUserId: string, optionId: string): Promise<ProductOptionProps> {
    const option = await this.repository.getOption(ownerUserId, optionId);
    if (!option) throw new OptionNotFoundError();
    return option;
  }
}
