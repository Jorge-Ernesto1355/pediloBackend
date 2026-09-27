import { PrismaUserRepository } from '../../infrastructure/persistence/PrismaUserRepository';
import { prisma } from '@/libs/prisma';
import { LoginUser } from '../../application/use-cases/LoginUser';
import { RegisterUser } from '../../application/use-cases/RegisterUser';
import { GetCurrentUser } from '../../application/use-cases/getCurrentUser';
import { AuthController } from './AuthController';
import { Router } from 'express';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from './auth.dependencies.js';
import { PrismaPasswordResetRepository } from '../../infrastructure/persistence/PrismaPasswordResetRepository.js';
import { ResendEmailService } from '../../infrastructure/email/ResendEmailService.js';
import { PasswordRecoveryService } from '../../application/services/PasswordRecoveryService.js';
import { PasswordRecoveryController } from './PasswordRecoveryController.js';
import { PasswordRecoveryRateLimiter } from './passwordRecoveryRateLimiter.js';
import { accountController } from '@/modules/Account/presentation/http/account.routes.js';

const userRepository = new PrismaUserRepository(prisma);

const registerUser = new RegisterUser(authProvider);
const loginUser = new LoginUser(authProvider);
const getCurrentUser = new GetCurrentUser(authProvider, userRepository);

const controller = new AuthController(registerUser, loginUser, getCurrentUser, authProvider);
const passwordRecovery = new PasswordRecoveryService(
  userRepository,
  new PrismaPasswordResetRepository(prisma),
  new ResendEmailService(),
);
const passwordRecoveryController = new PasswordRecoveryController(passwordRecovery);
const passwordRecoveryRateLimiter = new PasswordRecoveryRateLimiter();
export const requireAuth = createRequireAuth(authProvider);

export const authRouter = Router();
authRouter.post('/register', controller.register);
authRouter.post('/login', controller.login);
authRouter.post('/me', requireAuth, controller.me);
authRouter.post('/logout', controller.logout);
authRouter.post(
  '/forgot-password',
  passwordRecoveryRateLimiter.middleware(5, 15 * 60 * 1000, (request) => request.ip ?? 'unknown'),
  passwordRecoveryController.forgotPassword,
);
authRouter.post(
  '/reset-password',
  passwordRecoveryRateLimiter.middleware(10, 15 * 60 * 1000, (request) => request.ip ?? 'unknown'),
  passwordRecoveryController.resetPassword,
);
authRouter.post('/verify-email', accountController.verifyEmail);
