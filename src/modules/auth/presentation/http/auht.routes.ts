import { auth } from '@/libs/auth';
import { BetterAuthProvider } from '../../infrastructure/persistence/security/BetterAuthProvider';
import { PrismaUserRepository } from '../../infrastructure/persistence/PrismaUserRepository';
import { prisma } from '@/libs/prisma';
import { LoginUser } from '../../application/use-cases/LoginUser';
import { RegisterUser } from '../../application/use-cases/RegisterUser';
import { GetCurrentUser } from '../../application/use-cases/getCurrentUser';
import { AuthController } from './AuthController';
import { Router } from 'express';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';

const authProvider = new BetterAuthProvider(auth);
const userRepository = new PrismaUserRepository(prisma);

const registerUser = new RegisterUser(authProvider);
const loginUser = new LoginUser(authProvider);
const getCurrentUser = new GetCurrentUser(authProvider, userRepository);

const controller = new AuthController(registerUser, loginUser, getCurrentUser, authProvider);
export const requireAuth = createRequireAuth(authProvider);

export const authRouter = Router();
authRouter.post('/register', controller.register);
authRouter.post('/login', controller.login);
authRouter.post('/me', requireAuth, controller.me);
authRouter.post('/logout', controller.logout);
