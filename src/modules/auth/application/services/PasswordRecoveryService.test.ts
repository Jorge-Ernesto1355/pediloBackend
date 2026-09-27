import { describe, expect, it, vi } from 'vitest';
import { hashResetToken, PasswordRecoveryService } from './PasswordRecoveryService.js';

describe('PasswordRecoveryService', () => {
  it('hashes reset tokens and never persists the original token', async () => {
    const user = { getId: () => 'user-1', getEmail: () => 'user@example.com' };
    const users = { findByEmail: vi.fn().mockResolvedValue(user), findById: vi.fn() };
    const resetTokens = {
      cleanup: vi.fn(),
      hasCredential: vi.fn().mockResolvedValue(true),
      create: vi.fn(),
      resetPassword: vi.fn(),
    };
    const email = { send: vi.fn() };
    const service = new PasswordRecoveryService(users, resetTokens, email);

    await service.requestReset('user@example.com');

    const storedHash = resetTokens.create.mock.calls[0]?.[0].tokenHash as string;
    const sentUrl = email.send.mock.calls[0]?.[0].html as string;
    const originalToken = decodeURIComponent(sentUrl.match(/token=([^"&]+)/)?.[1] ?? '');
    expect(originalToken).toBeTruthy();
    expect(storedHash).toBe(hashResetToken(originalToken));
    expect(storedHash).not.toBe(originalToken);
    expect(email.send).toHaveBeenCalledOnce();
  });

  it('does not send email or persist a token for an unknown user', async () => {
    const resetTokens = {
      cleanup: vi.fn(),
      hasCredential: vi.fn(),
      create: vi.fn(),
      resetPassword: vi.fn(),
    };
    const email = { send: vi.fn() };
    const service = new PasswordRecoveryService(
      { findByEmail: vi.fn().mockResolvedValue(null), findById: vi.fn() },
      resetTokens,
      email,
    );

    await service.requestReset('missing@example.com');

    expect(resetTokens.create).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('passes a hashed password and hashed token to the reset port', async () => {
    const resetTokens = {
      cleanup: vi.fn(),
      hasCredential: vi.fn(),
      create: vi.fn(),
      resetPassword: vi.fn().mockResolvedValue(true),
    };
    const service = new PasswordRecoveryService(
      { findByEmail: vi.fn(), findById: vi.fn() },
      resetTokens,
      { send: vi.fn() },
    );

    expect(await service.resetPassword('plain-token', 'NewPassword123!')).toBe(true);
    expect(resetTokens.resetPassword).toHaveBeenCalledWith(
      expect.objectContaining({ tokenHash: hashResetToken('plain-token') }),
    );
    expect(resetTokens.resetPassword.mock.calls[0]?.[0].passwordHash).not.toBe('NewPassword123!');
  });
});
