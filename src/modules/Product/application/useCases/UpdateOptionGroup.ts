import { ProductOptionGroupProps } from '../../domain/entities/Product.js';
import { assertOptionGroupConfiguration } from '../../domain/entities/ProductOptionGroup.js';
import { OptionGroupNotFoundError } from '../../domain/errors/ProductOptionErrors.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';
import { UpdateOptionGroupDTO } from '../dto/ProductOptionDTO.js';

export class UpdateOptionGroup {
  constructor(private readonly repository: ProductOptionRepository) {}
  async execute(
    ownerUserId: string,
    groupId: string,
    dto: UpdateOptionGroupDTO,
    productId?: string,
  ): Promise<ProductOptionGroupProps> {
    const current = await this.repository.getGroup(ownerUserId, groupId);
    if (!current) throw new OptionGroupNotFoundError();
    if (productId !== undefined && current.productId !== productId)
      throw new OptionGroupNotFoundError();
    assertOptionGroupConfiguration({
      isRequired: dto.isRequired ?? current.isRequired,
      minSelections: dto.minSelections ?? current.minSelections,
      maxSelections: dto.maxSelections ?? current.maxSelections,
    });
    const updated = await this.repository.updateGroup(ownerUserId, groupId, dto);
    if (!updated) throw new OptionGroupNotFoundError();
    return updated;
  }
}
