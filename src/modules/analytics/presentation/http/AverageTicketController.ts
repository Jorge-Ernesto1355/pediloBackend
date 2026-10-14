import type { Request, Response } from 'express';
import { GetAverageTicket } from '../../application/services/GetAverageTicket.js';
import { averageTicketQuerySchema } from './average-ticket.schemas.js';

export class AverageTicketController {
  constructor(private readonly getAverageTicket: GetAverageTicket) {}

  get = (request: Request, response: Response): void => {
    const query = averageTicketQuerySchema.safeParse(request.query);
    if (!query.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_PERIOD',
          message: 'El periodo solicitado no es válido.',
          details: { allowed_values: ['today', '7d', '30d', 'this_month'] },
        },
      });
      return;
    }
    void this.getAverageTicket
      .execute(request.user!.id, query.data.period)
      .then((data) => response.json({ data }))
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
