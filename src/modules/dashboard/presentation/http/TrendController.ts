import type { Request, Response } from 'express';
import { GetSalesTrend } from '../../application/services/GetSalesTrend.js';
import { trendQuerySchema } from './trend.schemas.js';

export class TrendController {
  constructor(private readonly getSalesTrend: GetSalesTrend) {}

  get = (request: Request, response: Response): void => {
    const query = trendQuerySchema.safeParse(request.query);
    if (!query.success) {
      response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
      });
      return;
    }
    void this.getSalesTrend
      .execute(request.user!.id, query.data.period)
      .then((trend) => response.json(trend))
      .catch((error: unknown) => {
        if (error instanceof Error && 'statusCode' in error && 'code' in error) {
          const appError = error as Error & { statusCode: number; code: string };
          response
            .status(appError.statusCode)
            .json({ error: { code: appError.code, message: appError.message } });
          return;
        }
        response
          .status(500)
          .json({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
      });
  };
}
