import type { Request, Response } from 'express';
import { GetHistoricalSales } from '../../application/services/GetHistoricalSales.js';

export class HistoricalSalesController {
  constructor(private readonly getHistoricalSales: GetHistoricalSales) {}

  get = (request: Request, response: Response): void => {
    void this.getHistoricalSales
      .execute(request.user!.id)
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
