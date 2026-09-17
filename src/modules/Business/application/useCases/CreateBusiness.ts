import { Business } from '../../domain/Entities/Business.js';
import {
  BusinessAlreadyExistsError,
  UserAlreadyHasBusinessError,
} from '../../domain/errors/BusinessErrors.js';
import { BusinessRepository } from '../../domain/ports/BusinessRepository.js';
import { CreateBusinessDTO } from '../dto/BusinessDTO.js';

export class CreateBusiness {
  constructor(private readonly businessRepository: BusinessRepository) {}

  async execute(ownerUserId: string, dto: CreateBusinessDTO): Promise<Business> {
    if (await this.businessRepository.getByUserId(ownerUserId))
      throw new UserAlreadyHasBusinessError();

    const slug = dto.slug ?? slugify(dto.name);
    if (await this.businessRepository.getBySlug(slug)) throw new BusinessAlreadyExistsError();

    return this.businessRepository.create({ ...dto, slug, ownerUserId });
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
