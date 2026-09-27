import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { ResendEmailService } from '@/modules/auth/infrastructure/email/ResendEmailService.js';
import {
  PrismaAccountRepository,
  PrismaEmailVerificationTokenRepository,
} from '@/modules/auth/infrastructure/persistence/PrismaAccountRepository.js';
import { AccountService } from '@/modules/auth/application/services/AccountService.js';
import { AccountController } from './AccountController.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { PasswordRecoveryRateLimiter } from '@/modules/auth/presentation/http/passwordRecoveryRateLimiter.js';

const accountService = new AccountService(
  new PrismaAccountRepository(prisma),
  new PrismaEmailVerificationTokenRepository(prisma),
  new ResendEmailService(),
  authProvider,
);
export const accountController = new AccountController(accountService);
const requireAuth = createRequireAuth(authProvider);
const emailVerificationRateLimiter = new PasswordRecoveryRateLimiter();

export const accountRouter = Router();
accountRouter.use(requireAuth);
accountRouter.get('/', accountController.get);
accountRouter.patch('/', accountController.update);
accountRouter.post(
  '/email-verification',
  emailVerificationRateLimiter.middleware(
    3,
    15 * 60 * 1000,
    (request) => request.user?.id ?? request.ip ?? 'unknown',
  ),
  accountController.sendEmailVerification,
);
accountRouter.post(
  '/email-verification/resend',
  emailVerificationRateLimiter.middleware(
    3,
    15 * 60 * 1000,
    (request) => request.user?.id ?? request.ip ?? 'unknown',
  ),
  accountController.sendEmailVerification,
);
accountRouter.post('/change-password', accountController.changePassword);
