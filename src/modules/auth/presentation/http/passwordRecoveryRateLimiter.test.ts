import { describe, expect, it, vi } from 'vitest';
import { PasswordRecoveryRateLimiter } from './passwordRecoveryRateLimiter.js';

describe('PasswordRecoveryRateLimiter', () => {
  it('returns 429 after the configured limit', () => {
    const limiter = new PasswordRecoveryRateLimiter();
    const next = vi.fn();
    const response = {
      setHeader: vi.fn(),
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    const middleware = limiter.middleware(1, 60_000, () => 'same-client');
    middleware({} as never, response as never, next);
    middleware({} as never, response as never, next);
    expect(next).toHaveBeenCalledOnce();
    expect(response.status).toHaveBeenCalledWith(429);
  });
});
