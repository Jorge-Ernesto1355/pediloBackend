import { Product } from '../../domain/entities/Product.js';
import { ProductNotFoundError } from '../../domain/errors/ProductErrors.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';
import { UpdateProductDTO } from '../dto/ProductDTO.js';

export class UpdateProduct {
  constructor(private readonly repository: ProductRepository) {}

  async execute(ownerUserId: string, productId: string, dto: UpdateProductDTO): Promise<Product> {
    const product = await this.repository.update(ownerUserId, productId, dto);
    if (!product) throw new ProductNotFoundError();
    return product;
  }
}
