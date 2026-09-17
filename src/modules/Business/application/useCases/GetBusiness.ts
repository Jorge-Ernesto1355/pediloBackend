import { Business } from '../../domain/Entities/Business.js';
import { BusinessNotFoundError } from '../../domain/errors/BusinessErrors.js';
import { BusinessRepository } from '../../domain/ports/BusinessRepository.js';

export class GetBusiness {
  constructor(private readonly businessRepository: BusinessRepository) {}

  async byId(id: string): Promise<Business> {
    const business = await this.businessRepository.getById(id);
    if (!business) throw new BusinessNotFoundError();
    return business;
  }

  async bySlug(slug: string): Promise<Business> {
    const business = await this.businessRepository.getBySlug(slug);
    if (!business) throw new BusinessNotFoundError();
    return business;
  }

  execute(userId: string): Promise<Business | null> {
    return this.businessRepository.getByUserId(userId);
  }
}
