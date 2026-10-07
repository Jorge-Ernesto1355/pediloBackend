import { describe, expect, it, vi } from 'vitest';
import { APIError } from 'better-auth';
import type { auth as AuthClient } from '@/libs/auth.js';
import { EmailAlreadyExistsError } from '@/modules/auth/domain/errors/EmailAlreadyInUseError.js';
import { BetterAuthProvider } from './BetterAuthProvider.js';

const signupCookie =
  'better-auth.session_token=session-b.signature; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800';

function authResponse(user: { id: string; email: string; name: string }, cookie: string) {
  return new Response(
    JSON.stringify({
      token: `session-${user.id}`,
      user: { ...user, emailVerified: false, createdAt: '2026-10-07T12:00:00.000Z' },
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json', 'set-cookie': cookie },
    },
  );
}

function providerWith(signUpEmail: ReturnType<typeof vi.fn>) {
  const auth = { api: { signUpEmail } } as unknown as typeof AuthClient;
  return new BetterAuthProvider(auth);
}

describe('BetterAuthProvider signup session', () => {
  it('returns the newly registered identity and its Better Auth session cookie', async () => {
    const signUpEmail = vi
      .fn()
      .mockResolvedValue(
        authResponse({ id: 'user-b', email: 'b@example.test', name: 'User B' }, signupCookie),
      );
    const provider = providerWith(signUpEmail);

    const result = await provider.signUp({
      name: 'User B',
      email: 'b@example.test',
      password: 'Strong-pass-123',
    });

    expect(signUpEmail).toHaveBeenCalledOnce();
    expect(signUpEmail).toHaveBeenCalledWith({
      body: { name: 'User B', email: 'b@example.test', password: 'Strong-pass-123' },
      asResponse: true,
    });
    expect(result.user.toJSON()).toMatchObject({ id: 'user-b', email: 'b@example.test' });
    expect(result.setCookie).toContain(signupCookie);
    expect(result.setCookie[0]).toContain('Path=/');
    expect(result.setCookie[0]).toContain('HttpOnly');
    expect(result.setCookie[0]).toContain('SameSite=Lax');
    expect(result.setCookie[0]).toContain('Max-Age=604800');
  });

  it('does not return a session cookie when Better Auth rejects an existing email', async () => {
    const signUpEmail = vi.fn().mockRejectedValue(
      APIError.from('UNPROCESSABLE_ENTITY', {
        code: 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL',
        message: 'User already exists',
      }),
    );
    const provider = providerWith(signUpEmail);

    await expect(
      provider.signUp({
        name: 'Existing User',
        email: 'existing@example.test',
        password: 'Strong-pass-123',
      }),
    ).rejects.toBeInstanceOf(EmailAlreadyExistsError);
  });

  it('propagates the second signup cookie rather than retaining the first response cookie', async () => {
    const signUpEmail = vi
      .fn()
      .mockResolvedValueOnce(
        authResponse(
          { id: 'user-a', email: 'a@example.test', name: 'User A' },
          'better-auth.session_token=session-a.signature; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800',
        ),
      )
      .mockResolvedValueOnce(
        authResponse(
          { id: 'user-b', email: 'b@example.test', name: 'User B' },
          'better-auth.session_token=session-b.signature; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800',
        ),
      );
    const provider = providerWith(signUpEmail);

    await provider.signUp({ name: 'User A', email: 'a@example.test', password: 'Strong-pass-123' });
    const result = await provider.signUp({
      name: 'User B',
      email: 'b@example.test',
      password: 'Strong-pass-123',
    });

    expect(result.user.toJSON()).toMatchObject({ id: 'user-b', email: 'b@example.test' });
    expect(result.setCookie).toEqual([
      'better-auth.session_token=session-b.signature; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800',
    ]);
  });
});
