import { CategoryRepository } from '../../domain/ports/CategoryRepository.js';

export class MoveAllProductsAndDeleteCategory {
  constructor(private readonly repository: CategoryRepository) {}

  execute(ownerUserId: string, sourceCategoryId: string, targetCategoryId: string): Promise<void> {
    return this.repository.moveAllAndDelete(ownerUserId, sourceCategoryId, targetCategoryId);
  }
}
