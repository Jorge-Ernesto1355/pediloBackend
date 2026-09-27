import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/shared/config/env.js';
import { ImageStorage } from '../../application/ports/ImageStorage.js';
import {
  BusinessImageFile,
  BusinessImageType,
  UploadedImage,
} from '../../domain/Entities/BusinessImage.js';
import { createCloudinaryBlurUrl } from './cloudinary-url.js';

const uploadPresets = {
  logo: {
    folder: 'business-logos',
    quality: 'auto:eco',
    fetch_format: 'auto',
    width: 400,
    height: 400,
    crop: 'limit',
  },
  cover: {
    folder: 'business-covers',
    quality: 'auto:good',
    fetch_format: 'auto',
    width: 1600,
    height: 900,
    crop: 'limit',
  },
} as const;

export class CloudinaryImageStorage implements ImageStorage {
  private configured = false;

  private configure() {
    if (this.configured) return;
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      throw new Error('Cloudinary is not configured');
    }
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    this.configured = true;
  }

  async upload(
    file: BusinessImageFile,
    publicId: string,
    type: BusinessImageType,
  ): Promise<UploadedImage> {
    this.configure();
    const preset = uploadPresets[type.toLowerCase() as keyof typeof uploadPresets];
    if (!preset) throw new Error('Invalid business image type');
    const result = await new Promise<UploadedImage>((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { ...preset, public_id: publicId, resource_type: 'image', overwrite: true },
        (error, uploaded) => {
          if (error || !uploaded) return reject(error ?? new Error('Cloudinary upload failed'));
          resolve({
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            blurUrl: createCloudinaryBlurUrl(uploaded.secure_url),
          });
        },
      );
      stream.end(file.buffer);
    });
    return result;
  }

  async delete(publicId: string): Promise<void> {
    this.configure();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  }
}
