import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';
import { AppError } from '@/shared/errors/app-error.js';
import { GoogleReviewError } from '../../domain/errors/GoogleReviewErrors.js';
import { GetGoogleReviewStats } from '../../application/useCases/GetGoogleReviewStats.js';
import { TrackGoogleReviewScan } from '../../application/useCases/TrackGoogleReviewScan.js';
import { googleReviewStatsQuerySchema } from './google-review-stats.schemas.js';

export class GoogleReviewTrackingController {
  constructor(
    private readonly trackScan: TrackGoogleReviewScan,
    private readonly getStats: GetGoogleReviewStats,
  ) {}

  redirect = (request: Request, response: Response, next: NextFunction): void => {
    const parsed = qrCodeParamsSchema.safeParse(request.params);
    if (!parsed.success) {
      response
        .status(404)
        .json({ error: { code: 'GOOGLE_REVIEW_QR_NOT_FOUND', message: 'QR code was not found' } });
      return;
    }
    this.trackScan
      .execute(parsed.data.qrCode, {
        ipAddress: request.ip ?? '',
        userAgent: request.get('user-agent') ?? '',
      })
      .then((url) => response.redirect(302, url))
      .catch((error: unknown) => {
        if (error instanceof GoogleReviewError) {
          response
            .status(error.httpStatus)
            .json({ error: { code: error.code, message: error.message } });
          return;
        }
        next(error);
      });
  };

  stats = (request: Request, response: Response, next: NextFunction): void => {
    const parsed = googleReviewStatsQuerySchema.safeParse(request.query);
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

const qrCodeParamsSchema = z.object({
  qrCode: z.string().regex(/^[A-Za-z0-9_-]{20,64}$/),
});
