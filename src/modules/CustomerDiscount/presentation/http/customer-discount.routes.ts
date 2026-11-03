import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { PrismaCustomerDiscountRepository } from '../../infrastructure/persistence/PrismaCustomerDiscountRepository.js';
import { CustomerDiscountController } from './CustomerDiscountController.js';

const repository = new PrismaCustomerDiscountRepository(prisma);
const controller = new CustomerDiscountController(repository);
const requireAuth = createRequireAuth(authProvider);

export const customerDiscountRouter = Router();
customerDiscountRouter.post(
  '/:businessId/customer-discount/preview',
  controller.previewForCheckout,
);
customerDiscountRouter.get('/orders/:orderId/discount', requireAuth, controller.getForOrder);
customerDiscountRouter.post('/orders/:orderId/discount', requireAuth, controller.grantForOrder);
customerDiscountRouter.get('/customers/:customerId/discounts', requireAuth, controller.listForCustomer);
customerDiscountRouter.post('/customers/:customerId/discounts', requireAuth, controller.grantForCustomer);
customerDiscountRouter.delete('/customers/:customerId/discounts/:discountId', requireAuth, controller.revokeForCustomer);
