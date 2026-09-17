import { Menu } from '../../domain/entities/Menu.js';
import { MenuRepository } from '../../domain/ports/MenuRepository.js';

export class ListMenus {
  constructor(private readonly repository: MenuRepository) {}

  execute(ownerUserId: string, businessId?: string): Promise<Menu[]> {
    return this.repository.list(ownerUserId, businessId);
  }
}
