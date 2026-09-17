import { Product } from '../../domain/entities/Product.js';
import { ProductRepository } from '../../domain/ports/ProductRepository.js';
import { CreateProductDTO } from '../dto/ProductDTO.js';

export class CreateProduct {
  constructor(private readonly repository: ProductRepository) {}

  execute(ownerUserId: string, businessId: string, dto: CreateProductDTO): Promise<Product> {
    return this.repository.create({ ownerUserId, businessId, ...dto });
  }
}
