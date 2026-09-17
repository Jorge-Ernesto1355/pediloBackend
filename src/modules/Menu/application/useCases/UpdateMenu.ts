import { Menu } from '../../domain/entities/Menu.js';
import { MenuNotFoundError } from '../../domain/errors/MenuErrors.js';
import { MenuRepository } from '../../domain/ports/MenuRepository.js';
import { UpdateMenuDTO } from '../dto/MenuDTO.js';

export class UpdateMenu {
  constructor(private readonly repository: MenuRepository) {}

  async execute(ownerUserId: string, id: string, dto: UpdateMenuDTO): Promise<Menu> {
    const menu = await this.repository.update(ownerUserId, id, dto);
    if (!menu) throw new MenuNotFoundError();
    return menu;
  }
}
