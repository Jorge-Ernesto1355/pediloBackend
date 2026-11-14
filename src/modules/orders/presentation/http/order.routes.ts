import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateOrder } from '../../application/useCases/CreateOrder.js';
import { CreateRestaurantOrder } from '../../application/useCases/CreateRestaurantOrder.js';
import { GetOrder } from '../../application/useCases/GetOrder.js';
import { ListOrders } from '../../application/useCases/ListOrders.js';
import { UpdateOrderStatus } from '../../application/useCases/UpdateOrderStatus.js';
import { UpdateOrder } from '../../application/useCases/UpdateOrder.js';
import { PrismaOrderRepository } from '../../infrastructure/persistence/PrismaOrderRepository.js';
import { OrderController } from './OrderController.js';
const repository = new PrismaOrderRepository(prisma);
const controller = new OrderController(
  new CreateOrder(repository),
  new CreateRestaurantOrder(repository),
  new GetOrder(repository),
  new ListOrders(repository),
  new UpdateOrderStatus(repository),
  new UpdateOrder(repository),
);
const requireAuth = createRequireAuth(authProvider);
export const publicOrderRouter = Router();
// Public checkout must never depend on a restaurant session. Keep it in a
// separate router so authenticated middleware cannot accidentally cover it.
publicOrderRouter.post('/:businessId/orders', controller.create);

export const orderRouter = Router();
// Restaurant dashboard creation and every read/update route below are authenticated.
orderRouter.post('/:businessId/orders/restaurant', requireAuth, controller.createRestaurant);
orderRouter.get('/:businessId/orders', requireAuth, controller.list);
orderRouter.get('/orders/:orderId', requireAuth, controller.get);
orderRouter.patch('/orders/:orderId/status', requireAuth, controller.updateStatus);
orderRouter.patch('/orders/:orderId', requireAuth, controller.update);
