import {
  PublicBusinessCatalog,
  PublicDiscountPrice,
  PublicBusinessRepository,
} from '../ports/PublicBusinessRepository.js';

export class GetPublicBusinessCatalog {
  constructor(private readonly repository: PublicBusinessRepository) {}

  execute(slug: string): Promise<PublicBusinessCatalog | null> {
    return this.repository.getCatalogBySlug(slug);
  }

  executeDiscounts(slug: string): Promise<PublicDiscountPrice[] | null> {
    return this.repository.getActiveDiscountsBySlug(slug);
  }
}
