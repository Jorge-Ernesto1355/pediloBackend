import type { NextFunction, Request, Response } from 'express';
import { AppError } from '@/shared/errors/app-error.js';
import { GetPublicStoreVisitStats } from '../../application/useCases/GetPublicStoreVisitStats.js';
import { storeVisitStatsQuerySchema } from './store-visit-stats.schemas.js';

export class StoreVisitStatsController {
  constructor(private readonly getStats: GetPublicStoreVisitStats) {}

  get = (request: Request, response: Response, next: NextFunction): void => {
    const parsed = storeVisitStatsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_PERIOD',
          message: 'El periodo solicitado no es válido.',
          details: { allowed_values: ['today', '7d', '30d', 'thisMonth'] },
        },
      });
      return;
    }

    this.getStats
      .execute(request.user!.id, parsed.data.period)
      .then((data) => response.json({ data }))
      .catch((error: unknown) => {
        if (error instanceof AppError) {
          response
            .status(error.statusCode)
            .json({ error: { code: error.code, message: error.message } });
          return;
        }
        next(error);
      });
  };
}
