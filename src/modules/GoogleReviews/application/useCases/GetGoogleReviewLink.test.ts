import { describe, expect, it, vi } from 'vitest';
import { GetGoogleReviewLink } from './GetGoogleReviewLink.js';
import { GoogleReviewAccessDeniedError } from '../../domain/errors/GoogleReviewErrors.js';
import type { GoogleReviewRepository } from '../../domain/ports/GoogleReviewRepository.js';

function repository(isOwner: boolean): GoogleReviewRepository {
  return {
    isOwner: vi.fn().mockResolvedValue(isOwner),
    getDetailsByOwnerUserId: vi.fn().mockResolvedValue({
      business: {
        id: 'business-1',
        name: 'Restaurante',
        logoUrl: 'https://cdn.example/logo.png',
        coverUrl: 'https://cdn.example/cover.png',
      },
      link: null,
    }),
    upsertByOwnerUserId: vi.fn(),
    getRedirectByQrCode: vi.fn(),
    recordScan: vi.fn(),
    getStats: vi.fn(),
    getBusinessForStats: vi.fn(),
  };
}

describe('GetGoogleReviewLink', () => {
  it('returns the saved link and business branding details for the owner', async () => {
    const result = await new GetGoogleReviewLink(repository(true)).execute('user-1');

    expect(result).toEqual({
      business: {
        id: 'business-1',
        name: 'Restaurante',
        logoUrl: 'https://cdn.example/logo.png',
        coverUrl: 'https://cdn.example/cover.png',
      },
      link: null,
    });
  });

  it('rejects a user who is not the business owner', async () => {
    await expect(
      new GetGoogleReviewLink(repository(false)).execute('user-2'),
    ).rejects.toBeInstanceOf(GoogleReviewAccessDeniedError);
  });
});
