import { describe, expect, it, vi } from 'vitest';
import { GenerateGoogleReviewQr } from './GenerateGoogleReviewQr.js';
import {
  GoogleReviewAccessDeniedError,
  GoogleReviewLinkNotFoundError,
} from '../../domain/errors/GoogleReviewErrors.js';
import type { GoogleReviewRepository } from '../../domain/ports/GoogleReviewRepository.js';
import type { QrCodeGenerator } from '../ports/QrCodeGenerator.js';

function repository(overrides: Partial<GoogleReviewRepository> = {}): GoogleReviewRepository {
  return {
    isOwner: vi.fn().mockResolvedValue(true),
    getDetailsByOwnerUserId: vi.fn().mockResolvedValue({
      business: { id: 'business-1', name: 'Restaurante', logoUrl: null, coverUrl: null },
      link: {
        id: 'link-1',
        businessId: 'business-1',
        qrCode: 'c12345678901234567890123',
        url: 'https://g.page/r/CXExample/review',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    }),
    upsertByOwnerUserId: vi.fn(),
    getRedirectByQrCode: vi.fn(),
    recordScan: vi.fn(),
    getStats: vi.fn(),
    getBusinessForStats: vi.fn(),
    ...overrides,
  };
}

describe('GenerateGoogleReviewQr', () => {
  it('generates a tracked QR while retaining the stored review link', async () => {
    const qrCodeGenerator: QrCodeGenerator = {
      toPng: vi.fn().mockResolvedValue(Buffer.from('png')),
    };
    const result = await new GenerateGoogleReviewQr(
      repository(),
      qrCodeGenerator,
      'https://api.pedilo.mx/',
    ).execute('user-1');

    expect(result).toEqual({ image: Buffer.from('png'), businessId: 'business-1' });
    expect(qrCodeGenerator.toPng).toHaveBeenCalledWith(
      'https://api.pedilo.mx/r/c12345678901234567890123',
    );
  });

  it('rejects users who are not owners', async () => {
    const repo = repository({ isOwner: vi.fn().mockResolvedValue(false) });
    await expect(
      new GenerateGoogleReviewQr(repo, { toPng: vi.fn() }).execute('user-2'),
    ).rejects.toBeInstanceOf(GoogleReviewAccessDeniedError);
  });

  it('requires a link before generating a QR', async () => {
    const repo = repository({ getDetailsByOwnerUserId: vi.fn().mockResolvedValue(null) });
    await expect(
      new GenerateGoogleReviewQr(repo, { toPng: vi.fn() }).execute('user-1'),
    ).rejects.toBeInstanceOf(GoogleReviewLinkNotFoundError);
  });
});
