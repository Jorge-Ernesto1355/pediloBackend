import {
  BusinessAccessDeniedError,
  BusinessNotFoundError,
} from '../../domain/errors/BusinessErrors.js';
import { BusinessRepository } from '../../domain/ports/BusinessRepository.js';

export class DeleteBusiness {
  constructor(private readonly businessRepository: BusinessRepository) {}

  async execute(userId: string, id: string): Promise<void> {
    const owned = await this.businessRepository.getByUserId(userId);
    if (!owned || owned.id !== id) throw new BusinessAccessDeniedError();
    if (!(await this.businessRepository.delete(id))) throw new BusinessNotFoundError();
  }
}
