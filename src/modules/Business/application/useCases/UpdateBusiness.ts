import { Business } from '../../domain/Entities/Business.js';
import {
  BusinessAccessDeniedError,
  BusinessAlreadyExistsError,
  BusinessNotFoundError,
} from '../../domain/errors/BusinessErrors.js';
import { BusinessRepository } from '../../domain/ports/BusinessRepository.js';
import { UpdateBusinessDTO } from '../dto/BusinessDTO.js';
import { ImageStorage } from '../ports/ImageStorage.js';
import { BusinessImageType } from '../../domain/Entities/BusinessImage.js';

export class UpdateBusiness {
  constructor(
    private readonly businessRepository: BusinessRepository,
    private readonly imageStorage: ImageStorage,
  ) {}

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
    const oldImages = await this.businessRepository.getImages(id);
    const { logoFile, coverFile, ...businessFields } = dto;
    const updated = await this.businessRepository.update(id, businessFields);
    if (!updated) throw new BusinessNotFoundError();
    await this.replaceImage(
      id,
      'LOGO',
      logoFile,
      oldImages.find((image) => image.type === 'LOGO'),
    );
    await this.replaceImage(
      id,
      'COVER',
      coverFile,
      oldImages.find((image) => image.type === 'COVER'),
    );
    return (await this.businessRepository.getById(id))!;
  }

  private async replaceImage(
    id: string,
    type: BusinessImageType,
    source: import('../../domain/Entities/BusinessImage.js').BusinessImageFile | undefined,
    current?: { publicId: string },
  ) {
    if (source === undefined) return;
    const image = await this.imageStorage.upload(source, `${id}/${type.toLowerCase()}`, type);
    await this.businessRepository.saveImage(id, { ...image, type });
    if (current && current.publicId !== image.publicId)
      await this.imageStorage.delete(current.publicId);
  }
}
