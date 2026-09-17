import { Category } from '../../domain/entities/Category.js';
import { CategoryNotFoundError } from '../../domain/errors/CategoryErrors.js';
import { CategoryRepository } from '../../domain/ports/CategoryRepository.js';

export class SetCategoryActive {
  constructor(private readonly repository: CategoryRepository) {}

  async execute(ownerUserId: string, id: string, isActive: boolean): Promise<Category> {
    const category = await this.repository.setActive(ownerUserId, id, isActive);
    if (!category) throw new CategoryNotFoundError();
    return category;
  }
}
