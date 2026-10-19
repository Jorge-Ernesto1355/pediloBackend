import { GoogleReviewAccessDeniedError } from '../../domain/errors/GoogleReviewErrors.js';
import type {
  GoogleReviewLink,
  GoogleReviewRepository,
} from '../../domain/ports/GoogleReviewRepository.js';

export class SaveGoogleReviewLink {
  constructor(private readonly repository: GoogleReviewRepository) {}

  async execute(userId: string, url: string): Promise<GoogleReviewLink> {
    if (!(await this.repository.isOwner(userId))) {
      throw new GoogleReviewAccessDeniedError();
    }
    return this.repository.upsertByOwnerUserId(userId, url);
  }
}
