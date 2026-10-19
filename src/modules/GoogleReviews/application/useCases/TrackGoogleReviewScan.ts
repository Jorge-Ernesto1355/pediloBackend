import { GoogleReviewQrNotFoundError } from '../../domain/errors/GoogleReviewErrors.js';
import { isSafeGoogleReviewsUrl } from '../../domain/google-reviews-url.js';
import type { GoogleReviewRepository } from '../../domain/ports/GoogleReviewRepository.js';
import type { AnonymousVisitorHasher } from '../ports/AnonymousVisitorHasher.js';

const botUserAgent =
  /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|discord|monitor|uptime|headless/i;
const qrCodePattern = /^[A-Za-z0-9_-]{20,64}$/;
const dedupeWindowMs = 30 * 60 * 1000;

export class TrackGoogleReviewScan {
  constructor(
    private readonly repository: GoogleReviewRepository,
    private readonly visitorHasher: AnonymousVisitorHasher,
  ) {}

  async execute(
    qrCode: string,
    visitor: { ipAddress: string; userAgent: string },
    now = new Date(),
  ): Promise<string> {
    if (!qrCodePattern.test(qrCode)) throw new GoogleReviewQrNotFoundError();
    const details = await this.repository.getRedirectByQrCode(qrCode);
    if (!details || !isSafeGoogleReviewsUrl(details.link.url)) {
      throw new GoogleReviewQrNotFoundError();
    }

    if (visitor.ipAddress && visitor.userAgent && !botUserAgent.test(visitor.userAgent)) {
      const dedupeBucket = new Date(Math.floor(now.getTime() / dedupeWindowMs) * dedupeWindowMs);
      await this.repository.recordScan({
        businessId: details.link.businessId,
        googleReviewLinkId: details.link.id,
        visitedAt: now,
        visitorHash: this.visitorHasher.hash(visitor.ipAddress, visitor.userAgent),
        dedupeBucket,
      });
    }

    return details.link.url;
  }
}
