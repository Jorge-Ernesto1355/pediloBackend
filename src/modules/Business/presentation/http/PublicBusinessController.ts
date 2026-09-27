import { Request, Response } from 'express';
import { GetPublicBusinessCatalog } from '../../application/useCases/GetPublicBusinessCatalog.js';
import { businessSlugSchema } from './validators/business.schemas.js';

export class PublicBusinessController {
  constructor(private readonly getCatalogUseCase: GetPublicBusinessCatalog) {}

  getCatalog = async (request: Request, response: Response) => {
    const parsed = businessSlugSchema.safeParse(request.params);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });

    try {
      const catalog = await this.getCatalogUseCase.execute(parsed.data.slug);
      if (!catalog) {
        return response.status(404).json({
          error: { code: 'PUBLIC_BUSINESS_NOT_FOUND', message: 'Business not found' },
        });
      }
      return response.json(catalog);
    } catch {
      return response.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
      });
    }
  };
}
