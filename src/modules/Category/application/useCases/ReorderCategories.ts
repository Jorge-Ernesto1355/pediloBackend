import { Category } from '../../domain/entities/Category.js';
import { CategoryRepository } from '../../domain/ports/CategoryRepository.js';
import { ReorderCategoriesDTO } from '../dto/CategoryDTO.js';

export class ReorderCategories {
  constructor(private readonly repository: CategoryRepository) {}

  execute(ownerUserId: string, menuId: string, dto: ReorderCategoriesDTO): Promise<Category[]> {
    return this.repository.reorder(ownerUserId, menuId, dto);
  }
}
