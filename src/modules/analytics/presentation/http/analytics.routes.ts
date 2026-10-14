import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { GetAverageTicket } from '../../application/services/GetAverageTicket.js';
import { PrismaAverageTicketRepository } from '../../infrastructure/persistence/PrismaAverageTicketRepository.js';
import { AverageTicketController } from './AverageTicketController.js';

const controller = new AverageTicketController(
  new GetAverageTicket(new PrismaAverageTicketRepository(prisma)),
);
const requireAuth = createRequireAuth(authProvider);

export const analyticsRouter = Router();
analyticsRouter.get('/average-ticket', requireAuth, controller.get);
