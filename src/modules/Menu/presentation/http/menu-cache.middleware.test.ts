import { describe, expect, it, vi } from 'vitest';
import { noConditionalCatalogCache } from './menu-cache.middleware.js';

describe('noConditionalCatalogCache', () => {
  it('prevents conditional requests from turning the catalog into a bodyless 304', () => {
    const request = {
      headers: {
        'if-none-match': '"catalog-etag"',
        'if-modified-since': 'Tue, 01 Jan 2030 00:00:00 GMT',
      },
    };
    const response = { setHeader: vi.fn() };
    const next = vi.fn();

    noConditionalCatalogCache(request as never, response as never, next);

    expect(request.headers['if-none-match']).toBe('');
    expect(request.headers['if-modified-since']).toBe('');
    expect(response.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(next).toHaveBeenCalledOnce();
  });
});
