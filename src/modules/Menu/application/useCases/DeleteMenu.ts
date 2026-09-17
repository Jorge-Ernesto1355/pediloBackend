import { MenuNotFoundError } from '../../domain/errors/MenuErrors.js';
import { MenuRepository } from '../../domain/ports/MenuRepository.js';

export class DeleteMenu {
  constructor(private readonly repository: MenuRepository) {}

  async execute(ownerUserId: string, id: string): Promise<void> {
    if (!(await this.repository.delete(ownerUserId, id))) throw new MenuNotFoundError();
  }
}
