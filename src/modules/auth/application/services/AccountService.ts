import { createHash, randomBytes } from 'node:crypto';
import { env } from '@/shared/config/env.js';
import { EmailService } from '../ports/EmailService.js';
import { EmailVerificationTokenRepository } from '../ports/EmailVerificationTokenRepository.js';
import { AccountRepository } from '../ports/AccountRepository.js';
import { AuthProvider } from '../../domain/ports/AuthProvider.js';
import { AccountNameAlreadyInUseError } from '../../domain/errors/AccountErrors.js';
import { passwordVerificationEmail } from '../templates/passwordVerificationEmail.js';

export const INVALID_EMAIL_VERIFICATION_TOKEN =
  'Invalid, expired, or already used verification token.';

export class AccountService {
  constructor(
    private readonly accounts: AccountRepository,
    private readonly verificationTokens: EmailVerificationTokenRepository,
    private readonly emailService: EmailService,
    private readonly authProvider: AuthProvider,
  ) {}

  getProfile(userId: string) {
    return this.accounts.getProfile(userId);
  }

  async updateName(userId: string, name: string): Promise<void> {
    if (await this.accounts.hasNameConflict(userId, name)) {
      throw new AccountNameAlreadyInUseError();
    }
    await this.accounts.updateName(userId, name);
  }

  async requestEmailVerification(userId: string): Promise<'already-verified' | 'sent'> {
    const target = await this.accounts.getEmailVerificationTarget(userId);
    if (!target) throw new Error('Authenticated user was not found');
    if (target.emailVerified) return 'already-verified';

    await this.verificationTokens.cleanup();
    const token = randomBytes(32).toString('base64url');
    await this.verificationTokens.create({
      userId,
      tokenHash: hashVerificationToken(token),
      expiresAt: new Date(Date.now() + env.EMAIL_VERIFICATION_TOKEN_EXPIRATION_MINUTES * 60 * 1000),
    });

    const url = new URL('/verify-email', env.FRONTEND_URL);
    url.searchParams.set('token', token);
    const template = passwordVerificationEmail({
      appName: env.APP_NAME,
      verificationUrl: url.toString(),
      expirationMinutes: env.EMAIL_VERIFICATION_TOKEN_EXPIRATION_MINUTES,
    });
    await this.emailService.send({ to: target.email, ...template });
    return 'sent';
  }

  async verifyEmail(token: string): Promise<'verified' | 'already-verified' | 'invalid'> {
    return this.accounts.markEmailVerified(hashVerificationToken(token), new Date());
  }

  changePassword(headers: Headers, currentPassword: string, newPassword: string) {
    return this.authProvider.changePassword(headers, currentPassword, newPassword);
  }
}

export function hashVerificationToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}
