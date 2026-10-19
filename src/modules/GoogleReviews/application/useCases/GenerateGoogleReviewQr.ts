import {
  GoogleReviewAccessDeniedError,
  GoogleReviewLinkNotFoundError,
} from '../../domain/errors/GoogleReviewErrors.js';
import type { GoogleReviewRepository } from '../../domain/ports/GoogleReviewRepository.js';
import type { QrCodeGenerator } from '../ports/QrCodeGenerator.js';

export class GenerateGoogleReviewQr {
  constructor(
    private readonly repository: GoogleReviewRepository,
    private readonly qrCodeGenerator: QrCodeGenerator,
    private readonly publicApiUrl = 'http://localhost:3000',
  ) {}

  async execute(userId: string): Promise<{ image: Buffer; businessId: string }> {
    if (!(await this.repository.isOwner(userId))) {
      throw new GoogleReviewAccessDeniedError();
    }
    const details = await this.repository.getDetailsByOwnerUserId(userId);
    if (!details?.link) throw new GoogleReviewLinkNotFoundError();
    return {
      image: await this.qrCodeGenerator.toPng(
        `${this.publicApiUrl.replace(/\/$/, '')}/r/${details.link.qrCode}`,
      ),
      businessId: details.link.businessId,
    };
  }
}
