import { ProductOptionProps } from '../../domain/entities/Product.js';
import { OptionNotFoundError } from '../../domain/errors/ProductOptionErrors.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';
import { UpdateOptionDTO } from '../dto/ProductOptionDTO.js';

export class UpdateOption {
  constructor(private readonly repository: ProductOptionRepository) {}
  async execute(
    ownerUserId: string,
    optionId: string,
    dto: UpdateOptionDTO,
  ): Promise<ProductOptionProps> {
    const option = await this.repository.updateOption(ownerUserId, optionId, dto);
    if (!option) throw new OptionNotFoundError();
    return option;
  }
}
