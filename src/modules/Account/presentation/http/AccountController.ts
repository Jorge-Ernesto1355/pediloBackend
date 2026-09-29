import { Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { AuthDomainError } from '@/modules/auth/domain/errors/AuthDomainError.js';
import {
  INVALID_EMAIL_VERIFICATION_TOKEN,
  AccountService,
} from '@/modules/auth/application/services/AccountService.js';
import {
  changePasswordSchema,
  updateAccountSchema,
  verifyEmailSchema,
} from './validators/account.schemas.js';

export class AccountController {
  constructor(private readonly accountService: AccountService) {}

  get = async (request: Request, response: Response) => {
    const profile = await this.accountService.getProfile(this.userId(request));
    if (!profile)
      return response.status(404).json({ success: false, message: 'Account not found' });
    return response.status(200).json({ success: true, data: profile });
  };

  update = async (request: Request, response: Response) => {
    const parsed = updateAccountSchema.safeParse(request.body);
    if (!parsed.success)
      return response.status(400).json({ success: false, error: parsed.error.flatten() });

    try {
      await this.accountService.updateName(this.userId(request), parsed.data.name);
      return response.status(200).json({
        success: true,
        message: 'Account updated successfully',
        data: { name: parsed.data.name },
      });
    } catch (error) {
      return this.handleError(response, error);
    }
  };

  sendEmailVerification = async (request: Request, response: Response) => {
    try {
      const result = await this.accountService.requestEmailVerification(this.userId(request));
      return response.status(200).json({
        success: true,
        message:
          result === 'already-verified' ? 'Email is already verified' : 'Verification email sent',
      });
    } catch (error) {
      return this.handleError(response, error);
    }
  };

  verifyEmail = async (request: Request, response: Response) => {
    const parsed = verifyEmailSchema.safeParse(request.body);
    if (!parsed.success) {
      return response
        .status(400)
        .json({ success: false, message: INVALID_EMAIL_VERIFICATION_TOKEN });
    }

    const result = await this.accountService.verifyEmail(parsed.data.token);
    if (result === 'invalid') {
      return response
        .status(400)
        .json({ success: false, message: INVALID_EMAIL_VERIFICATION_TOKEN });
    }
    return response.status(200).json({
      success: true,
      message:
        result === 'already-verified' ? 'Email already verified' : 'Email verified successfully',
    });
  };

  changePassword = async (request: Request, response: Response) => {
    const parsed = changePasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      const hasPasswordError = parsed.error.issues.some((issue) => issue.path[0] === 'newPassword');
      return response.status(400).json({
        success: false,
        message: hasPasswordError
          ? 'Password does not meet the security requirements'
          : 'Current password is required',
      });
    }

    try {
      const setCookie = await this.accountService.changePassword(
        fromNodeHeaders(request.headers),
        parsed.data.currentPassword,
        parsed.data.newPassword,
      );
      for (const cookie of setCookie) response.append('Set-Cookie', cookie);
      return response.status(200).json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      return this.handleError(response, error);
    }
  };

  private userId(request: Request): string {
    if (!request.user?.id) throw new Error('Authenticated user is missing');
    return request.user.id;
  }

  private handleError(response: Response, error: unknown) {
    if (error instanceof AuthDomainError) {
      return response.status(error.httpStatus).json({ success: false, message: error.message });
    }
    return response.status(500).json({ success: false, message: 'Unexpected error' });
  }
}
