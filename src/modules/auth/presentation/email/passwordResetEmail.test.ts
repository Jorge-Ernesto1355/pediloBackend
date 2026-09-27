import { describe, expect, it } from 'vitest';
import { passwordResetEmail } from './passwordResetEmail.js';

describe('passwordResetEmail', () => {
  it('includes email-compatible HTML and a plain-text fallback', () => {
    const email = passwordResetEmail({
      appName: 'Pedilo',
      resetUrl: 'https://example.com/reset-password?token=abc',
      expirationMinutes: 30,
    });
    expect(email.html).toContain('<table');
    expect(email.html).toContain('Restablecer contraseña');
    expect(email.text).toContain('https://example.com/reset-password?token=abc');
    expect(email.html).not.toContain('<script');
  });
});
