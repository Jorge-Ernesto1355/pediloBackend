import { Menu } from '../../domain/entities/Menu.js';
import { MenuRepository } from '../../domain/ports/MenuRepository.js';
import { CreateMenuDTO } from '../dto/MenuDTO.js';

export class CreateMenu {
  constructor(private readonly repository: MenuRepository) {}

  execute(ownerUserId: string, businessId: string, dto: CreateMenuDTO): Promise<Menu> {
    return this.repository.create({ ownerUserId, businessId, ...dto });
  }
}
