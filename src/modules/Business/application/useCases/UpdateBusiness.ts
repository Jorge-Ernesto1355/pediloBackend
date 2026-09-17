import { Business } from '../../domain/Entities/Business.js';
import {
  BusinessAccessDeniedError,
  BusinessAlreadyExistsError,
  BusinessNotFoundError,
} from '../../domain/errors/BusinessErrors.js';
import { BusinessRepository } from '../../domain/ports/BusinessRepository.js';
import { UpdateBusinessDTO } from '../dto/BusinessDTO.js';

export class UpdateBusiness {
  constructor(private readonly businessRepository: BusinessRepository) {}

  async execute(userId: string, id: string, dto: UpdateBusinessDTO): Promise<Business> {
    const owned = await this.businessRepository.getByUserId(userId);
    if (!owned) throw new BusinessAccessDeniedError();
    if (owned.id !== id) throw new BusinessAccessDeniedError();
    if (
      dto.slug &&
      dto.slug !== owned.slug &&
      (await this.businessRepository.getBySlug(dto.slug))
    ) {
      throw new BusinessAlreadyExistsError();
    }
    const updated = await this.businessRepository.update(id, dto);
    if (!updated) throw new BusinessNotFoundError();
    return updated;
  }
}
