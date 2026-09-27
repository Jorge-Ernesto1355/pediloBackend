import { createHash, randomBytes } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { env } from '@/shared/config/env.js';
import { UserRepository } from '../../domain/ports/userRepository.js';
import { EmailService } from '../ports/EmailService.js';
import { PasswordResetRepository } from '../ports/PasswordResetRepository.js';
import { passwordResetEmail } from '../../presentation/email/passwordResetEmail.js';

export const GENERIC_FORGOT_PASSWORD_MESSAGE =
  'If an account exists with this email, you will receive instructions to reset your password.';
export const INVALID_RESET_TOKEN_MESSAGE = 'Invalid or expired reset token.';

export function hashResetToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export class PasswordRecoveryService {
  constructor(
    private readonly users: UserRepository,
    private readonly resetTokens: PasswordResetRepository,
    private readonly emailService: EmailService,
  ) {}

  async requestReset(email: string): Promise<void> {
    await this.resetTokens.cleanup();
    const user = await this.users.findByEmail(email.trim().toLowerCase());
    if (!user || !(await this.resetTokens.hasCredential(user.getId()))) return;

    const token = randomBytes(32).toString('base64url');
    const expiresAt = new Date(
      Date.now() + env.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES * 60 * 1000,
    );
    await this.resetTokens.create({
      userId: user.getId(),
      tokenHash: hashResetToken(token),
      expiresAt,
    });

    const resetUrl = new URL('/reset-password', env.FRONTEND_URL);
    resetUrl.searchParams.set('token', token);
    const template = passwordResetEmail({
      appName: env.APP_NAME,
      resetUrl: resetUrl.toString(),
      expirationMinutes: env.PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES,
    });
    await this.emailService.send({ to: user.getEmail(), ...template });
  }

  async resetPassword(token: string, newPassword: string): Promise<boolean> {
    const passwordHash = await hashPassword(newPassword);
    return this.resetTokens.resetPassword({
      tokenHash: hashResetToken(token),
      passwordHash,
      now: new Date(),
    });
  }
}
