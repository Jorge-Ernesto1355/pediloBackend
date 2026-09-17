import { Category } from '../../domain/entities/Category.js';
import { CategoryNotFoundError } from '../../domain/errors/CategoryErrors.js';
import { CategoryRepository } from '../../domain/ports/CategoryRepository.js';

export class GetCategory {
  constructor(private readonly repository: CategoryRepository) {}

  async execute(ownerUserId: string, id: string): Promise<Category> {
    const category = await this.repository.getById(ownerUserId, id);
    if (!category) throw new CategoryNotFoundError();
    return category;
  }
}
