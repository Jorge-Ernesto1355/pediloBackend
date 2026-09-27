import { v2 as cloudinary } from 'cloudinary';
import { env } from '@/shared/config/env.js';
import { ProductImageFile, UploadedProductImage } from '../../domain/entities/ProductImage.js';
import { ProductImageStorage } from '../../application/ports/ProductImageStorage.js';

const PRODUCT_PRESET = {
  folder: 'product-images',
  quality: 'auto:eco',
  fetch_format: 'auto',
  width: 800,
  height: 800,
  crop: 'limit',
} as const;

export class CloudinaryProductImageStorage implements ProductImageStorage {
  private configured = false;

  private configure() {
    if (this.configured) return;
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET)
      throw new Error('Cloudinary is not configured');
    cloudinary.config({
      cloud_name: env.CLOUDINARY_CLOUD_NAME,
      api_key: env.CLOUDINARY_API_KEY,
      api_secret: env.CLOUDINARY_API_SECRET,
    });
    this.configured = true;
  }

  async upload(file: ProductImageFile, publicId: string): Promise<UploadedProductImage> {
    this.configure();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { ...PRODUCT_PRESET, public_id: publicId, resource_type: 'image', overwrite: true },
        (error, uploaded) => {
          if (error || !uploaded) return reject(error ?? new Error('Cloudinary upload failed'));
          resolve({
            url: uploaded.secure_url,
            publicId: uploaded.public_id,
            blurUrl: createBlurUrl(uploaded.secure_url),
          });
        },
      );
      stream.end(file.buffer);
    });
  }

  async delete(publicId: string): Promise<void> {
    this.configure();
    await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
  }
}

function createBlurUrl(secureUrl: string): string {
  const marker = '/upload/';
  const index = secureUrl.indexOf(marker);
  if (index === -1) return secureUrl;
  const insertionPoint = index + marker.length;
  return `${secureUrl.slice(0, insertionPoint)}e_blur:1000,q_1,w_50/${secureUrl.slice(insertionPoint)}`;
}
