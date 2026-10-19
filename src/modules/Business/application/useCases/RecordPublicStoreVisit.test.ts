import { describe, expect, it, vi } from 'vitest';
import { RecordPublicStoreVisit } from './RecordPublicStoreVisit.js';
import type { AnonymousStoreVisitorHasher } from '../ports/AnonymousStoreVisitorHasher.js';
import type { StoreVisitEvent, StoreVisitRepository } from '../ports/StoreVisitRepository.js';

function setup() {
  const events = new Set<string>();
  const recordVisit = vi.fn(async (event: StoreVisitEvent) => {
    const key = `${event.businessId}:${event.visitorHash}:${event.dedupeBucket.toISOString()}`;
    if (events.has(key)) return false;
    events.add(key);
    return true;
  });
  const repository = {
    recordVisit,
    getBusinessForStats: vi.fn(),
    getStats: vi.fn(),
  } as unknown as StoreVisitRepository;
  const hasher: AnonymousStoreVisitorHasher = {
    hash: vi.fn().mockReturnValue('opaque-visitor-hash'),
  };
  return { recordVisit, hasher, useCase: new RecordPublicStoreVisit(repository, hasher) };
}

describe('RecordPublicStoreVisit', () => {
  const visitor = { ipAddress: '192.0.2.42', userAgent: 'Mozilla/5.0 Chrome' };
  const now = new Date('2026-10-16T18:17:00.000Z');

  it('records an anonymous visit in a 30-minute deduplication bucket', async () => {
    const { recordVisit, hasher, useCase } = setup();
    await expect(useCase.execute('business-1', visitor, now)).resolves.toBe(true);
    expect(hasher.hash).toHaveBeenCalledWith(visitor.ipAddress, visitor.userAgent);
    expect(recordVisit).toHaveBeenCalledWith({
      businessId: 'business-1',
      visitedAt: now,
      visitorHash: 'opaque-visitor-hash',
      dedupeBucket: new Date('2026-10-16T18:00:00.000Z'),
    });
    expect(JSON.stringify(recordVisit.mock.calls)).not.toContain(visitor.ipAddress);
  });

  it('deduplicates a repeat catalog load in the same window and counts again in the next', async () => {
    const { recordVisit, useCase } = setup();
    await expect(useCase.execute('business-1', visitor, now)).resolves.toBe(true);
    await expect(
      useCase.execute('business-1', visitor, new Date('2026-10-16T18:29:59.000Z')),
    ).resolves.toBe(false);
    await expect(
      useCase.execute('business-1', visitor, new Date('2026-10-16T18:30:00.000Z')),
    ).resolves.toBe(true);
    expect(recordVisit).toHaveBeenCalledTimes(3);
  });

  it.each([
    { ipAddress: '', userAgent: 'Mozilla/5.0 Chrome' },
    { ipAddress: '192.0.2.42', userAgent: '' },
    { ipAddress: '192.0.2.42', userAgent: 'Googlebot/2.1' },
    { ipAddress: '192.0.2.42', userAgent: 'Slackbot-LinkExpanding 1.0' },
  ])('does not record bots or requests without a usable visitor fingerprint', async (request) => {
    const { recordVisit, hasher, useCase } = setup();
    await expect(useCase.execute('business-1', request, now)).resolves.toBe(false);
    expect(hasher.hash).not.toHaveBeenCalled();
    expect(recordVisit).not.toHaveBeenCalled();
  });
});
