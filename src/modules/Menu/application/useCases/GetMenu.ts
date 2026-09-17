import { Menu } from '../../domain/entities/Menu.js';
import { MenuNotFoundError } from '../../domain/errors/MenuErrors.js';
import { MenuRepository } from '../../domain/ports/MenuRepository.js';

export class GetMenu {
  constructor(private readonly repository: MenuRepository) {}

  async execute(ownerUserId: string, id: string): Promise<Menu> {
    const menu = await this.repository.getById(ownerUserId, id);
    if (!menu) throw new MenuNotFoundError();
    return menu;
  }
}
