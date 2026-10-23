import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { GetPublicStoreVisitStats } from '../../application/useCases/GetPublicStoreVisitStats.js';
import { PrismaStoreVisitRepository } from '../../infrastructure/persistence/PrismaStoreVisitRepository.js';
import { StoreVisitStatsController } from './StoreVisitStatsController.js';

const storeVisitRepository = new PrismaStoreVisitRepository(prisma);
const statsController = new StoreVisitStatsController(
  new GetPublicStoreVisitStats(storeVisitRepository),
);
const requireAuth = createRequireAuth(authProvider);

export const storeVisitRouter = Router();
storeVisitRouter.get('/store-visits/stats', requireAuth, statsController.get);
