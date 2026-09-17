import { OptionGroupNotFoundError } from '../../domain/errors/ProductOptionErrors.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class DeleteOptionGroup {
  constructor(private readonly repository: ProductOptionRepository) {}
  async execute(ownerUserId: string, groupId: string): Promise<void> {
    if (!(await this.repository.deleteGroup(ownerUserId, groupId)))
      throw new OptionGroupNotFoundError();
  }
}
