import { ProductOptionProps } from '../../domain/entities/Product.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';
import { CreateOptionDTO } from '../dto/ProductOptionDTO.js';

export class CreateOption {
  constructor(private readonly repository: ProductOptionRepository) {}
  execute(ownerUserId: string, groupId: string, dto: CreateOptionDTO): Promise<ProductOptionProps> {
    return this.repository.createOption(ownerUserId, groupId, {
      name: dto.name,
      price: dto.price ?? 0,
      isAvailable: dto.isAvailable ?? true,
    });
  }
}
