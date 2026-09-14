import { describe, expect, it, vi } from 'vitest';
import type { Request } from 'express';
import { User } from '@/modules/auth/domain/entities/User.js';
import { createRequireAuth } from './auth.middleware.js';

const request = (headers: Record<string, string> = {}) => ({ headers }) as Request;

const response = () => {
  const result = {
    status: vi.fn(),
    json: vi.fn(),
  };
  result.status.mockReturnValue(result);
  return result;
};

describe('requireAuth', () => {
  it('rejects requests without an authenticated session', async () => {
    const sessionReader = { getSession: vi.fn().mockResolvedValue(null) };
    const middleware = createRequireAuth(sessionReader);
    const res = response();

    await middleware(request({ cookie: 'session=invalid' }), res as never, vi.fn());

    expect(sessionReader.getSession).toHaveBeenCalledOnce();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'NOT_AUTHENTICATED',
        message: 'User is not authenticated',
      },
    });
  });

  it('attaches the authenticated user and continues', async () => {
    const user = User.create({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
      emailVerified: true,
      createdAt: new Date(),
    });
    const sessionReader = { getSession: vi.fn().mockResolvedValue(user) };
    const middleware = createRequireAuth(sessionReader);
    const req = request({ cookie: 'session=valid' });
    const next = vi.fn();

    await middleware(req, response() as never, next);

    expect(req.user).toEqual({
      id: 'user-1',
      email: 'user@example.com',
      name: 'Test User',
    });
    expect(next).toHaveBeenCalledOnce();
  });
});
