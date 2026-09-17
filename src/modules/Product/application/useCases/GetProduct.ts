import { Product } from '../../domain/entities/Product.js';
import { ProductNotFoundError } from '../../domain/errors/ProductErrors.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';

export class GetProduct {
  constructor(private readonly repository: ProductRepository) {}

  async execute(ownerUserId: string, productId: string): Promise<Product> {
    const product = await this.repository.getById(ownerUserId, productId);
    if (!product) throw new ProductNotFoundError();
    return product;
  }
}
