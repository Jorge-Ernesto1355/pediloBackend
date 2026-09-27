import { Product } from '../../domain/entities/Product.js';
import { ProductNotFoundError } from '../../domain/errors/ProductErrors.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';
import { UpdateProductDTO } from '../dto/ProductDTO.js';
import { ProductImageStorage } from '../ports/ProductImageStorage.js';

export class UpdateProduct {
  constructor(
    private readonly repository: ProductRepository,
    private readonly imageStorage?: ProductImageStorage,
  ) {}

  async execute(ownerUserId: string, productId: string, dto: UpdateProductDTO): Promise<Product> {
    const { imageFile, ...fields } = dto;
    if (
      imageFile &&
      (!this.imageStorage || !this.repository.getImage || !this.repository.saveImage)
    )
      throw new Error('Product image services are not configured');
    if (imageFile && !(await this.repository.getById(ownerUserId, productId)))
      throw new ProductNotFoundError();
    const currentImage = imageFile ? await this.repository.getImage!(ownerUserId, productId) : null;
    if (imageFile && currentImage) await this.imageStorage!.delete(currentImage.publicId);
    if (imageFile) {
      let uploadedPublicId: string | undefined;
      try {
        const image = await this.imageStorage!.upload(imageFile, `products/${productId}`);
        uploadedPublicId = image.publicId;
        const product = await this.repository.update(ownerUserId, productId, fields);
        if (!product) throw new ProductNotFoundError();
        await this.repository.saveImage!(ownerUserId, productId, image);
      } catch (error) {
        if (uploadedPublicId)
          await this.imageStorage!.delete(uploadedPublicId).catch(() => undefined);
        throw error;
      }
    } else {
      const product = await this.repository.update(ownerUserId, productId, fields);
      if (!product) throw new ProductNotFoundError();
      return product;
    }
    return (await this.repository.getById(ownerUserId, productId))!;
  }
}
