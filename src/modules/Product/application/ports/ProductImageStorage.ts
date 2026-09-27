import { ProductImageFile, UploadedProductImage } from '../../domain/entities/ProductImage.js';

export interface ProductImageStorage {
  upload(file: ProductImageFile, publicId: string): Promise<UploadedProductImage>;
  delete(publicId: string): Promise<void>;
}
