import { assertOptionGroupConfiguration } from '../../domain/entities/ProductOptionGroup.js';
import { ProductOptionGroupProps } from '../../domain/entities/Product.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';
import { CreateOptionGroupDTO } from '../dto/ProductOptionDTO.js';

export class CreateOptionGroup {
  constructor(private readonly repository: ProductOptionRepository) {}
  execute(
    ownerUserId: string,
    productId: string,
    dto: CreateOptionGroupDTO,
  ): Promise<ProductOptionGroupProps> {
    const input = {
      isRequired: dto.isRequired ?? false,
      minSelections: dto.minSelections ?? 0,
      maxSelections: dto.maxSelections ?? 1,
    };
    assertOptionGroupConfiguration(input);
    return this.repository.createGroup({
      ownerUserId,
      productId,
      name: dto.name,
      ...input,
      isActive: dto.isActive ?? true,
      options: (dto.options ?? []).map((option) => ({
        name: option.name,
        price: option.price ?? 0,
        isAvailable: option.isAvailable ?? true,
      })),
    });
  }
}
