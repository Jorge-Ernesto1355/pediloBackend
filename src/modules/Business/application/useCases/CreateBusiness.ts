import { Business } from '../../domain/Entities/Business.js';
import {
    BusinessAlreadyExistsError,
    UserAlreadyHasBusinessError,
} from '../../domain/errors/BusinessErrors.js';
import { BusinessRepository } from '../../domain/ports/BusinessRepository.js';
import { CreateBusinessDTO } from '../dto/BusinessDTO.js';
import { ImageStorage } from '../ports/ImageStorage.js';

export class CreateBusiness {
    constructor(
        private readonly businessRepository: BusinessRepository,
        private readonly imageStorage: ImageStorage,
    ) { }

    async execute(ownerUserId: string, dto: CreateBusinessDTO): Promise<Business> {
        if (await this.businessRepository.getByUserId(ownerUserId))
            throw new UserAlreadyHasBusinessError();

        const slug = dto.slug ?? slugify(dto.name);
        if (await this.businessRepository.getBySlug(slug)) throw new BusinessAlreadyExistsError();

        const business = await this.businessRepository.create({
            ...dto,
            logoUrl: undefined,
            coverUrl: undefined,
            slug,
            ownerUserId,
        });

        const uploadedImages: string[] = [];
        try {
            uploadedImages.push(...(await this.saveImageIfProvided(business.id, 'LOGO', dto.logoFile)));
            uploadedImages.push(...(await this.saveImageIfProvided(business.id, 'COVER', dto.coverFile)));
        } catch (error) {
            await Promise.all(
                uploadedImages.map((publicId) => this.imageStorage.delete(publicId).catch(() => undefined)),
            );
            await this.businessRepository.delete(business.id);
            throw error;
        }
        return (await this.businessRepository.getById(business.id))!;
    }

    private async saveImageIfProvided(
        id: string,
        type: 'LOGO' | 'COVER',
        source?: import('../../domain/Entities/BusinessImage.js').BusinessImageFile,
    ): Promise<string[]> {
        if (!source) return [];
        const image = await this.imageStorage.upload(
            source,
            `businesses/${id}/${type.toLowerCase()}`,
            type,
        );
        await this.businessRepository.saveImage(id, { ...image, type });
        return [image.publicId];
    }
}

function slugify(value: string): string {
    return value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}
