import { ProductNotFoundError } from '../../domain/errors/ProductErrors.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';

export class DeleteProduct {
  constructor(private readonly repository: ProductRepository) {}

  async execute(ownerUserId: string, productId: string): Promise<void> {
    if (!(await this.repository.delete(ownerUserId, productId))) throw new ProductNotFoundError();
  }
}
