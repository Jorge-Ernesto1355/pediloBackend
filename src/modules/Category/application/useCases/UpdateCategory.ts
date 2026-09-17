import { Category } from '../../domain/entities/Category.js';
import { CategoryNotFoundError } from '../../domain/errors/CategoryErrors.js';
import { CategoryRepository } from '../../domain/ports/CategoryRepository.js';
import { UpdateCategoryDTO } from '../dto/CategoryDTO.js';

export class UpdateCategory {
  constructor(private readonly repository: CategoryRepository) {}

  async execute(ownerUserId: string, id: string, dto: UpdateCategoryDTO): Promise<Category> {
    const category = await this.repository.update(ownerUserId, id, dto);
    if (!category) throw new CategoryNotFoundError();
    return category;
  }
}
