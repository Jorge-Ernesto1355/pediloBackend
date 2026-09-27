import { Product } from '../../domain/entities/Product.js';
import {
  ProductManagementFilters,
  ProductManagementRepository,
} from '../ports/ProductManagementRepository.js';

export class ListProductsAdmin {
  constructor(private readonly repository: ProductManagementRepository) {}
  execute(
    ownerUserId: string,
    filters: ProductManagementFilters,
  ): Promise<{ products: Product[]; total: number }> {
    return this.repository.listAdmin(ownerUserId, filters);
  }
}
