import { Category } from '../../domain/entities/Category.js';
import { CategoryRepository } from '../../domain/ports/CategoryRepository.js';
import { CreateCategoryDTO } from '../dto/CategoryDTO.js';

export class CreateCategory {
  constructor(private readonly categoryRepository: CategoryRepository) {}

  async execute(
    ownerUserId: string,
    businessId: string,
    dto: CreateCategoryDTO,
  ): Promise<Category> {
    return this.categoryRepository.create({
      ownerUserId,
      businessId,
      menuId: dto.menuId,
      name: dto.name,
      description: dto.description,
    });
  }
}
