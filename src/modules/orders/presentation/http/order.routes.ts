import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateOrder } from '../../application/useCases/CreateOrder.js';
import { GetOrder } from '../../application/useCases/GetOrder.js';
import { ListOrders } from '../../application/useCases/ListOrders.js';
import { UpdateOrderStatus } from '../../application/useCases/UpdateOrderStatus.js';
import { PrismaOrderRepository } from '../../infrastructure/persistence/PrismaOrderRepository.js';
import { PasswordRecoveryRateLimiter } from '@/modules/auth/presentation/http/passwordRecoveryRateLimiter.js';
import { OrderController } from './OrderController.js';
const repository = new PrismaOrderRepository(prisma);
const controller = new OrderController(
  new CreateOrder(repository),
  new GetOrder(repository),
  new ListOrders(repository),
  new UpdateOrderStatus(repository),
);
const requireAuth = createRequireAuth(authProvider);
const publicOrderRateLimiter = new PasswordRecoveryRateLimiter();
export const orderRouter = Router();
orderRouter.post(
  '/:businessId/orders',
  publicOrderRateLimiter.middleware(30, 15 * 60 * 1000, (request) => request.ip ?? 'unknown'),
  controller.create,
);
orderRouter.get('/:businessId/orders', requireAuth, controller.list);
orderRouter.get('/orders/:orderId', requireAuth, controller.get);
orderRouter.patch('/orders/:orderId/status', requireAuth, controller.updateStatus);
