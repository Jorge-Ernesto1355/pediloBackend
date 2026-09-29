import type { Request, Response } from 'express';
import { GetSalesDashboard } from '../../application/services/GetSalesDashboard.js';
import { salesQuerySchema } from './sales.schemas.js';

export class SalesController {
  constructor(private readonly getSalesDashboard: GetSalesDashboard) {}

  get = (request: Request, response: Response): void => {
    const query = salesQuerySchema.safeParse(request.query);
    if (!query.success) {
      response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
      });
      return;
    }
    void this.getSalesDashboard
      .execute(request.user!.id, query.data.period)
      .then((sales) => response.json(sales))
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
