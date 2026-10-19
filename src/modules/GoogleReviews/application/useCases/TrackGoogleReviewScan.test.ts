import { describe, expect, it, vi } from 'vitest';
import { TrackGoogleReviewScan } from './TrackGoogleReviewScan.js';
import { GoogleReviewQrNotFoundError } from '../../domain/errors/GoogleReviewErrors.js';
import type { GoogleReviewRepository } from '../../domain/ports/GoogleReviewRepository.js';
import type { AnonymousVisitorHasher } from '../ports/AnonymousVisitorHasher.js';

const link = {
  id: 'link-1',
  businessId: 'business-1',
  qrCode: 'c12345678901234567890123',
  url: 'https://g.page/r/CXExample/review',
  createdAt: new Date(),
  updatedAt: new Date(),
};

function setup(url = link.url) {
  const repository: GoogleReviewRepository = {
    isOwner: vi.fn(),
    getDetailsByOwnerUserId: vi.fn(),
    upsertByOwnerUserId: vi.fn(),
    getRedirectByQrCode: vi.fn().mockResolvedValue({ link: { ...link, url } }),
    recordScan: vi.fn().mockResolvedValue(true),
    getStats: vi.fn(),
    getBusinessForStats: vi.fn(),
  };
  const hasher: AnonymousVisitorHasher = { hash: vi.fn().mockReturnValue('hashed-visitor') };
  return { repository, hasher, useCase: new TrackGoogleReviewScan(repository, hasher) };
}

describe('TrackGoogleReviewScan', () => {
  const now = new Date('2026-10-16T18:17:00.000Z');

  it('returns the saved Google destination and records an anonymous scan', async () => {
    const { repository, hasher, useCase } = setup();
    await expect(
      useCase.execute(link.qrCode, { ipAddress: '192.0.2.8', userAgent: 'Mozilla Chrome' }, now),
    ).resolves.toBe(link.url);
    expect(hasher.hash).toHaveBeenCalledWith('192.0.2.8', 'Mozilla Chrome');
    expect(repository.recordScan).toHaveBeenCalledWith({
      businessId: link.businessId,
      googleReviewLinkId: link.id,
      visitedAt: now,
      visitorHash: 'hashed-visitor',
      dedupeBucket: new Date('2026-10-16T18:00:00.000Z'),
    });
  });

  it('still redirects when the repository deduplicates a repeat visit', async () => {
    const { repository, useCase } = setup();
    vi.mocked(repository.recordScan).mockResolvedValue(false);
    await expect(
      useCase.execute(link.qrCode, { ipAddress: '192.0.2.8', userAgent: 'Mozilla Chrome' }, now),
    ).resolves.toBe(link.url);
    expect(repository.recordScan).toHaveBeenCalledOnce();
  });

  it('redirects likely bots but does not record them', async () => {
    const { repository, useCase } = setup();
    await useCase.execute(
      link.qrCode,
      {
        ipAddress: '192.0.2.8',
        userAgent: 'Googlebot/2.1',
      },
      now,
    );
    expect(repository.recordScan).not.toHaveBeenCalled();
  });

  it('rejects malformed and arbitrary redirect targets', async () => {
    const malformed = setup();
    await expect(
      malformed.useCase.execute('not-a-valid-code', { ipAddress: 'x', userAgent: 'browser' }, now),
    ).rejects.toBeInstanceOf(GoogleReviewQrNotFoundError);
    expect(malformed.repository.getRedirectByQrCode).not.toHaveBeenCalled();

    const unsafe = setup('https://attacker.example/redirect');
    await expect(
      unsafe.useCase.execute(link.qrCode, { ipAddress: 'x', userAgent: 'browser' }, now),
    ).rejects.toBeInstanceOf(GoogleReviewQrNotFoundError);
    expect(unsafe.repository.recordScan).not.toHaveBeenCalled();
  });
});
