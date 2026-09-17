import { OptionNotFoundError } from '../../domain/errors/ProductOptionErrors.js';
import { ProductOptionRepository } from '../../domain/ports/ProductOptionRepository.js';

export class DeleteOption {
  constructor(private readonly repository: ProductOptionRepository) {}
  async execute(ownerUserId: string, optionId: string): Promise<void> {
    if (!(await this.repository.deleteOption(ownerUserId, optionId)))
      throw new OptionNotFoundError();
  }
}
