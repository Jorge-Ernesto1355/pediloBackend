import type { AnonymousStoreVisitorHasher } from '../ports/AnonymousStoreVisitorHasher.js';
import type { StoreVisitRepository } from '../ports/StoreVisitRepository.js';

const dedupeWindowMs = 30 * 60 * 1000;
const botUserAgent =
  /bot|crawler|spider|preview|facebookexternalhit|slackbot|whatsapp|discord|monitor|uptime|headless/i;

export class RecordPublicStoreVisit {
  constructor(
    private readonly repository: StoreVisitRepository,
    private readonly visitorHasher: AnonymousStoreVisitorHasher,
  ) {}

  async execute(
    businessId: string,
    visitor: { ipAddress: string; userAgent: string },
    now = new Date(),
  ): Promise<boolean> {
    if (!visitor.ipAddress || !visitor.userAgent || botUserAgent.test(visitor.userAgent)) {
      return false;
    }
    const dedupeBucket = new Date(Math.floor(now.getTime() / dedupeWindowMs) * dedupeWindowMs);
    return this.repository.recordVisit({
      businessId,
      visitedAt: now,
      visitorHash: this.visitorHasher.hash(visitor.ipAddress, visitor.userAgent),
      dedupeBucket,
    });
  }
}
