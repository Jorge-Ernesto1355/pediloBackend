import { CategoryNotFoundError } from '../../domain/errors/CategoryErrors.js';
import { CategoryRepository } from '../../domain/ports/CategoryRepository.js';

export class DeleteCategory {
  constructor(private readonly repository: CategoryRepository) {}

  async execute(ownerUserId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(ownerUserId, id))) throw new CategoryNotFoundError();
  }
}
