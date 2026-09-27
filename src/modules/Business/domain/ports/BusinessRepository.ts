import { Business, BusinessProps } from '../Entities/Business.js';
import { BusinessImageType, UploadedImage } from '../Entities/BusinessImage.js';
export { BusinessImageType } from '../Entities/BusinessImage.js';

export interface BusinessImageAsset extends UploadedImage {
  type: BusinessImageType;
}

export interface BusinessRepository {
  create(input: CreateBusinessRepositoryInput): Promise<Business>;
  getById(id: string): Promise<Business | null>;
  getBySlug(slug: string): Promise<Business | null>;
  getByUserId(userId: string): Promise<Business | null>;
  list(skip: number, take: number): Promise<Business[]>;
  update(id: string, input: UpdateBusinessRepositoryInput): Promise<Business | null>;
  delete(id: string): Promise<boolean>;
  getImages(id: string): Promise<BusinessImageAsset[]>;
  saveImage(id: string, image: BusinessImageAsset): Promise<void>;
  deleteImage(id: string, type: BusinessImageType): Promise<void>;
}

export interface CreateBusinessRepositoryInput extends Omit<
  BusinessProps,
  'id' | 'createdAt' | 'updatedAt'
> {
  ownerUserId: string;
}

export type UpdateBusinessRepositoryInput = {
  [Key in keyof Omit<BusinessProps, 'id' | 'createdAt' | 'updatedAt'>]?:
    Omit<BusinessProps, 'id' | 'createdAt' | 'updatedAt'>[Key] | null;
};
