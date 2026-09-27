import {
  BusinessImageFile,
  BusinessImageType,
  UploadedImage,
} from '../../domain/Entities/BusinessImage.js';

export interface ImageStorage {
  upload(
    file: BusinessImageFile,
    publicId: string,
    type: BusinessImageType,
  ): Promise<UploadedImage>;
  delete(publicId: string): Promise<void>;
}
