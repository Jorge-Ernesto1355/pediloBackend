import {
  BusinessAccessDeniedError,
  BusinessNotFoundError,
} from '../../domain/errors/BusinessErrors.js';
import { BusinessRepository } from '../../domain/ports/BusinessRepository.js';
import { ImageStorage } from '../ports/ImageStorage.js';

export class DeleteBusiness {
  constructor(
    private readonly businessRepository: BusinessRepository,
    private readonly imageStorage: ImageStorage,
  ) {}

  async execute(userId: string, id: string): Promise<void> {
    const owned = await this.businessRepository.getByUserId(userId);
    if (!owned || owned.id !== id) throw new BusinessAccessDeniedError();
    const images = await this.businessRepository.getImages(id);
    if (!(await this.businessRepository.delete(id))) throw new BusinessNotFoundError();
    await Promise.all(
      images.map((image) => this.imageStorage.delete(image.publicId).catch(() => undefined)),
    );
  }
}
