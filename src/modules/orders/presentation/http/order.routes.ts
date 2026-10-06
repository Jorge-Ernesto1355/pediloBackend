import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateOrder } from '../../application/useCases/CreateOrder.js';
import { CreateRestaurantOrder } from '../../application/useCases/CreateRestaurantOrder.js';
import { GetOrder } from '../../application/useCases/GetOrder.js';
import { ListOrders } from '../../application/useCases/ListOrders.js';
import { UpdateOrderStatus } from '../../application/useCases/UpdateOrderStatus.js';
import { PrismaOrderRepository } from '../../infrastructure/persistence/PrismaOrderRepository.js';
import { OrderController } from './OrderController.js';
const repository = new PrismaOrderRepository(prisma);
const controller = new OrderController(
  new CreateOrder(repository),
  new CreateRestaurantOrder(repository),
  new GetOrder(repository),
  new ListOrders(repository),
  new UpdateOrderStatus(repository),
);
const requireAuth = createRequireAuth(authProvider);
export const orderRouter = Router();
orderRouter.post('/:businessId/orders', controller.create);
orderRouter.post('/:businessId/orders/restaurant', requireAuth, controller.createRestaurant);
orderRouter.get('/:businessId/orders', requireAuth, controller.list);
orderRouter.get('/orders/:orderId', requireAuth, controller.get);
orderRouter.patch('/orders/:orderId/status', requireAuth, controller.updateStatus);
