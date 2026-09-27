import { Request, Response } from 'express';
import {
  GENERIC_FORGOT_PASSWORD_MESSAGE,
  INVALID_RESET_TOKEN_MESSAGE,
  PasswordRecoveryService,
} from '../../application/services/PasswordRecoveryService.js';
import {
  forgotPasswordSchema,
  resetPasswordSchema,
} from './validators/password-recovery.schemas.js';

export class PasswordRecoveryController {
  constructor(private readonly recovery: PasswordRecoveryService) {}

  forgotPassword = async (request: Request, response: Response) => {
    const parsed = forgotPasswordSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });

    try {
      await this.recovery.requestReset(parsed.data.email);
    } catch (error) {
      // Do not expose account existence or token/email-provider details.
      console.error(
        '[password-recovery] request failed:',
        error instanceof Error ? error.message : error,
      );
    }
    return response.status(200).json({ success: true, message: GENERIC_FORGOT_PASSWORD_MESSAGE });
  };

  resetPassword = async (request: Request, response: Response) => {
    const parsed = resetPasswordSchema.safeParse(request.body);
    if (!parsed.success) return response.status(400).json({ error: parsed.error.flatten() });

    const valid = await this.recovery.resetPassword(parsed.data.token, parsed.data.newPassword);
    if (!valid)
      return response.status(400).json({ success: false, message: INVALID_RESET_TOKEN_MESSAGE });
    return response.status(200).json({ success: true, message: 'Password reset successfully.' });
  };
}
