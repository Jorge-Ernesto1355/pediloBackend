import { Product } from '../../domain/entities/Product.js';
import { ProductNotFoundError } from '../../domain/errors/ProductErrors.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';

export class SetProductAvailable {
  constructor(private readonly repository: ProductRepository) {}

  async execute(ownerUserId: string, productId: string, isAvailable: boolean): Promise<Product> {
    const product = await this.repository.setAvailable(ownerUserId, productId, isAvailable);
    if (!product) throw new ProductNotFoundError();
    return product;
  }
}
