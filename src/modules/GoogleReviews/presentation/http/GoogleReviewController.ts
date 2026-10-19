import type { NextFunction, Request, Response } from 'express';
import { GetGoogleReviewLink } from '../../application/useCases/GetGoogleReviewLink.js';
import { GenerateGoogleReviewQr } from '../../application/useCases/GenerateGoogleReviewQr.js';
import { SaveGoogleReviewLink } from '../../application/useCases/SaveGoogleReviewLink.js';
import { GoogleReviewError } from '../../domain/errors/GoogleReviewErrors.js';
import { googleReviewLinkSchema } from './google-review.schemas.js';

export class GoogleReviewController {
  constructor(
    private readonly getLink: GetGoogleReviewLink,
    private readonly saveLink: SaveGoogleReviewLink,
    private readonly generateQr: GenerateGoogleReviewQr,
  ) {}

  get = (request: Request, response: Response, next: NextFunction): void => {
    this.getLink
      .execute(request.user!.id)
      .then((details) =>
        response.json({
          link: details?.link ?? null,
          business: details?.business ?? null,
        }),
      )
      .catch((error: unknown) => this.handleError(response, error, next));
  };

  save = (request: Request, response: Response, next: NextFunction): void => {
    const parsed = googleReviewLinkSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request validation failed',
          details: parsed.error.flatten(),
        },
      });
      return;
    }
    this.saveLink
      .execute(request.user!.id, parsed.data.url)
      .then((link) => response.json({ link }))
      .catch((error: unknown) => this.handleError(response, error, next));
  };

  qr = (request: Request, response: Response, next: NextFunction): void => {
    this.generateQr
      .execute(request.user!.id)
      .then(({ image, businessId }) => {
        response
          .status(200)
          .type('png')
          .setHeader(
            'Content-Disposition',
            `attachment; filename="google-reviews-${businessId}.png"`,
          )
          .send(image);
      })
      .catch((error: unknown) => this.handleError(response, error, next));
  };

  private handleError(response: Response, error: unknown, next: NextFunction): void {
    if (error instanceof GoogleReviewError) {
      response
        .status(error.httpStatus)
        .json({ error: { code: error.code, message: error.message } });
      return;
    }
    next(error);
  }
}
