import type {
  GoogleReviewDetails,
  GoogleReviewRepository,
} from '../../domain/ports/GoogleReviewRepository.js';
import { GoogleReviewAccessDeniedError } from '../../domain/errors/GoogleReviewErrors.js';

export class GetGoogleReviewLink {
  constructor(private readonly repository: GoogleReviewRepository) {}

  async execute(userId: string): Promise<GoogleReviewDetails | null> {
    if (!(await this.repository.isOwner(userId))) {
      throw new GoogleReviewAccessDeniedError();
    }
    return this.repository.getDetailsByOwnerUserId(userId);
  }
}
