import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { GetSalesDashboard } from '../../application/services/GetSalesDashboard.js';
import { PrismaSalesRepository } from '../../infrastructure/persistence/PrismaSalesRepository.js';
import { SalesController } from './SalesController.js';

const controller = new SalesController(new GetSalesDashboard(new PrismaSalesRepository(prisma)));
const requireAuth = createRequireAuth(authProvider);

export const salesRouter = Router();
salesRouter.get('/sales', requireAuth, controller.get);
