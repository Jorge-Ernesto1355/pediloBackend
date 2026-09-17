import { Menu } from '../../domain/entities/Menu.js';
import { MenuNotFoundError } from '../../domain/errors/MenuErrors.js';
import { MenuRepository } from '../../domain/ports/MenuRepository.js';

export class SetMenuActive {
  constructor(private readonly repository: MenuRepository) {}

  async execute(ownerUserId: string, id: string, isActive: boolean): Promise<Menu> {
    const menu = await this.repository.setActive(ownerUserId, id, isActive);
    if (!menu) throw new MenuNotFoundError();
    return menu;
  }
}
