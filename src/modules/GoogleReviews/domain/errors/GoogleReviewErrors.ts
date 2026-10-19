export abstract class GoogleReviewError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class GoogleReviewAccessDeniedError extends GoogleReviewError {
  readonly httpStatus = 403;
  readonly code = 'GOOGLE_REVIEW_ACCESS_DENIED';

  constructor() {
    super('Only the business owner can manage the Google review link');
  }
}

export class GoogleReviewLinkNotFoundError extends GoogleReviewError {
  readonly httpStatus = 404;
  readonly code = 'GOOGLE_REVIEW_LINK_NOT_FOUND';

  constructor() {
    super('Google review link has not been configured');
  }
}

export class GoogleReviewQrNotFoundError extends GoogleReviewError {
  readonly httpStatus = 404;
  readonly code = 'GOOGLE_REVIEW_QR_NOT_FOUND';

  constructor() {
    super('QR code was not found');
  }
}
