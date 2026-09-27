import { describe, expect, it, vi } from 'vitest';
import { AccountService, hashVerificationToken } from './AccountService.js';

describe('AccountService', () => {
  it('creates a hashed, expiring verification token and sends the email', async () => {
    const accounts = {
      getProfile: vi.fn(),
      hasNameConflict: vi.fn(),
      updateName: vi.fn(),
      getEmailVerificationTarget: vi.fn().mockResolvedValue({
        email: 'user@example.com',
        emailVerified: false,
      }),
      markEmailVerified: vi.fn(),
    };
    const tokens = { cleanup: vi.fn(), create: vi.fn() };
    const email = { send: vi.fn() };
    const auth = { changePassword: vi.fn() };
    const service = new AccountService(accounts, tokens, email, auth as never);

    await service.requestEmailVerification('user-1');

    const hash = tokens.create.mock.calls[0]?.[0].tokenHash as string;
    const html = email.send.mock.calls[0]?.[0].html as string;
    const token = html.match(/token=([^"&]+)/)?.[1] ?? '';
    expect(token).toBeTruthy();
    expect(hash).toBe(hashVerificationToken(token));
    expect(hash).not.toBe(token);
    expect(email.send).toHaveBeenCalledWith(expect.objectContaining({ to: 'user@example.com' }));
  });

  it('does not create or send a token for an already verified email', async () => {
    const accounts = {
      getProfile: vi.fn(),
      hasNameConflict: vi.fn(),
      updateName: vi.fn(),
      getEmailVerificationTarget: vi.fn().mockResolvedValue({
        email: 'user@example.com',
        emailVerified: true,
      }),
      markEmailVerified: vi.fn(),
    };
    const tokens = { cleanup: vi.fn(), create: vi.fn() };
    const email = { send: vi.fn() };
    const service = new AccountService(accounts, tokens, email, {
      changePassword: vi.fn(),
    } as never);

    await expect(service.requestEmailVerification('user-1')).resolves.toBe('already-verified');
    expect(tokens.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('hashes the verification token before confirming it', async () => {
    const accounts = {
      getProfile: vi.fn(),
      hasNameConflict: vi.fn(),
      updateName: vi.fn(),
      getEmailVerificationTarget: vi.fn(),
      markEmailVerified: vi.fn().mockResolvedValue('verified'),
    };
    const service = new AccountService(
      accounts,
      { cleanup: vi.fn(), create: vi.fn() },
      { send: vi.fn() },
      { changePassword: vi.fn() } as never,
    );

    await expect(service.verifyEmail('plain-token')).resolves.toBe('verified');
    expect(accounts.markEmailVerified).toHaveBeenCalledWith(
      hashVerificationToken('plain-token'),
      expect.any(Date),
    );
  });
});
