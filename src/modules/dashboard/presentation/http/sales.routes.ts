import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { GetSalesDashboard } from '../../application/services/GetSalesDashboard.js';
import { PrismaSalesRepository } from '../../infrastructure/persistence/PrismaSalesRepository.js';
import { SalesController } from './SalesController.js';
import { GetSalesTrend } from '../../application/services/GetSalesTrend.js';
import { PrismaTrendRepository } from '../../infrastructure/persistence/PrismaTrendRepository.js';
import { TrendController } from './TrendController.js';
import { GetHistoricalSales } from '../../application/services/GetHistoricalSales.js';
import { PrismaHistoricalSalesRepository } from '../../infrastructure/persistence/PrismaHistoricalSalesRepository.js';
import { HistoricalSalesController } from './HistoricalSalesController.js';

const controller = new SalesController(new GetSalesDashboard(new PrismaSalesRepository(prisma)));
const trendController = new TrendController(new GetSalesTrend(new PrismaTrendRepository(prisma)));
const historicalSalesController = new HistoricalSalesController(
  new GetHistoricalSales(new PrismaHistoricalSalesRepository(prisma)),
);
const requireAuth = createRequireAuth(authProvider);

export const salesRouter = Router();
salesRouter.get('/sales', requireAuth, controller.get);
salesRouter.get('/trend', requireAuth, trendController.get);
salesRouter.get('/historical-sales', requireAuth, historicalSalesController.get);
