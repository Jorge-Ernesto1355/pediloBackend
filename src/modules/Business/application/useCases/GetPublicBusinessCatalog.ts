import {
  PublicBusinessCatalog,
  PublicBusinessRepository,
} from '../ports/PublicBusinessRepository.js';

export class GetPublicBusinessCatalog {
  constructor(private readonly repository: PublicBusinessRepository) {}

  execute(slug: string): Promise<PublicBusinessCatalog | null> {
    return this.repository.getCatalogBySlug(slug);
  }
}
