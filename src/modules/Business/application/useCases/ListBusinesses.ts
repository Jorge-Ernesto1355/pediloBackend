import { Business } from '../../domain/Entities/Business.js';
import { BusinessRepository } from '../../domain/ports/BusinessRepository.js';

export class ListBusinesses {
  constructor(private readonly businessRepository: BusinessRepository) {}

  execute(page = 1, limit = 20): Promise<Business[]> {
    return this.businessRepository.list((page - 1) * limit, limit);
  }
}
