import { describe, expect, it, vi } from 'vitest';
import { trustedOriginGuard } from './origin-guard.js';

function response() {
  const json = vi.fn();
  return { status: vi.fn().mockReturnValue({ json }), json };
}

describe('trustedOriginGuard', () => {
  it('allows requests without an Origin header for non-browser clients', () => {
    const next = vi.fn();
    trustedOriginGuard(
      { method: 'POST', get: () => undefined } as never,
      response() as never,
      next,
    );
    expect(next).toHaveBeenCalledOnce();
  });

  it('rejects state-changing requests from an untrusted origin', () => {
    const next = vi.fn();
    const res = response();
    trustedOriginGuard(
      { method: 'POST', get: () => 'https://untrusted.example' } as never,
      res as never,
      next,
    );
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
