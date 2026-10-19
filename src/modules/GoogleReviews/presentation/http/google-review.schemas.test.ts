import { describe, expect, it } from 'vitest';
import { googleReviewLinkSchema } from './google-review.schemas.js';

describe('googleReviewLinkSchema', () => {
  it('accepts official HTTPS Google review links', () => {
    expect(
      googleReviewLinkSchema.safeParse({
        url: 'https://g.page/r/CXExample/review',
      }).success,
    ).toBe(true);
    expect(
      googleReviewLinkSchema.safeParse({
        url: 'https://search.google.com/local/writereview?placeid=ChIJExample',
      }).success,
    ).toBe(true);
  });

  it('rejects non-HTTPS, non-Google, and credential-bearing links', () => {
    for (const url of [
      'http://g.page/r/CXExample/review',
      'https://example.com/review',
      'https://google.com.evil.example/review',
      'https://user:password@g.page/r/CXExample/review',
    ]) {
      expect(googleReviewLinkSchema.safeParse({ url }).success).toBe(false);
    }
  });
});
