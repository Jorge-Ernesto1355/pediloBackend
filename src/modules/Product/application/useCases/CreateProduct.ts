import { Product } from '../../domain/entities/Product.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';
import { CreateProductDTO } from '../dto/ProductDTO.js';
import { ProductImageStorage } from '../ports/ProductImageStorage.js';

export class CreateProduct {
  constructor(
    private readonly repository: ProductRepository,
    private readonly imageStorage?: ProductImageStorage,
  ) {}

  async execute(ownerUserId: string, businessId: string, dto: CreateProductDTO): Promise<Product> {
    const { imageFile, ...fields } = dto;
    if (imageFile && (!this.imageStorage || !this.repository.saveImage))
      throw new Error('Product image services are not configured');
    const product = await this.repository.create({ ownerUserId, businessId, ...fields });
    if (!imageFile) return product;
    const imageStorage = this.imageStorage;
    const repository = this.repository;
    if (!imageStorage || !repository.saveImage)
      throw new Error('Product image services are not configured');
    const productId = product.toJSON().id;
    let uploadedPublicId: string | undefined;
    try {
      const image = await imageStorage.upload(imageFile, `products/${productId}`);
      uploadedPublicId = image.publicId;
      await repository.saveImage(ownerUserId, productId, image);
    } catch (error) {
      if (uploadedPublicId) await imageStorage.delete(uploadedPublicId).catch(() => undefined);
      await this.repository.delete(ownerUserId, productId);
      throw error;
    }
    return (await this.repository.getById(ownerUserId, productId))!;
  }
}
