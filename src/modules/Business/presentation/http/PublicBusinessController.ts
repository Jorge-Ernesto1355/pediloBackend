import { Request, Response } from 'express';
import { GetPublicBusinessCatalog } from '../../application/useCases/GetPublicBusinessCatalog.js';
import { RecordPublicStoreVisit } from '../../application/useCases/RecordPublicStoreVisit.js';
import { businessSlugSchema } from './validators/business.schemas.js';
import { z } from 'zod';

export class PublicBusinessController {
  constructor(
    private readonly getCatalogUseCase: GetPublicBusinessCatalog,
    private readonly recordVisit: RecordPublicStoreVisit,
  ) {}

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
      try {
        await this.recordVisit.execute(catalog.business.id, {
          ipAddress: request.ip ?? '',
          userAgent: request.get('user-agent') ?? '',
        });
      } catch (error) {
        console.error(
          'public_store_visit_record_failed',
          error instanceof Error ? error.name : 'UnknownError',
        );
      }
      return response.json(catalog);
    } catch {
      return response.status(500).json({
        error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' },
      });
    }
  };

  getDiscounts = async (request: Request, response: Response) => {
    const parsed = businessSlugSchema.safeParse(request.params);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });
    try {
      const discounts = await this.getCatalogUseCase.executeDiscounts(parsed.data.slug);
      if (!discounts)
        return response
          .status(404)
          .json({ error: { code: 'PUBLIC_BUSINESS_NOT_FOUND', message: 'Business not found' } });
      return response.json({ discounts });
    } catch {
      return response
        .status(500)
        .json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
    }
  };

  getSlugByQrCodeToken = async (request: Request, response: Response) => {
    const parsed = z
      .object({ token: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/) })
      .safeParse(request.params);
    if (!parsed.success)
      return response
        .status(404)
        .json({ error: { code: 'PUBLIC_QR_NOT_FOUND', message: 'QR code not found' } });
    try {
      const slug = await this.getCatalogUseCase.executeSlugByQrCodeToken(parsed.data.token);
      if (!slug)
        return response
          .status(404)
          .json({ error: { code: 'PUBLIC_QR_NOT_FOUND', message: 'QR code not found' } });
      return response.json({ slug });
    } catch {
      return response
        .status(500)
        .json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
    }
  };
}
