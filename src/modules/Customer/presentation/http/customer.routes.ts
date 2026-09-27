import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateCustomer } from '../../application/useCases/CreateCustomer.js';
import { DeleteCustomer } from '../../application/useCases/DeleteCustomer.js';
import { GetCustomer } from '../../application/useCases/GetCustomer.js';
import { ListCustomers } from '../../application/useCases/ListCustomers.js';
import { UpdateCustomer } from '../../application/useCases/UpdateCustomer.js';
import { PrismaCustomerRepository } from '../../infrastructure/persistence/PrismaCustomerRepository.js';
import { CustomerController } from './CustomerController.js';
const repository = new PrismaCustomerRepository(prisma);
const controller = new CustomerController(
  new CreateCustomer(repository),
  new GetCustomer(repository),
  new ListCustomers(repository),
  new UpdateCustomer(repository),
  new DeleteCustomer(repository),
);
const requireAuth = createRequireAuth(authProvider);
export const customerRouter = Router();
customerRouter.post('/:businessId/customers', requireAuth, controller.create);
customerRouter.get('/:businessId/customers', requireAuth, controller.list);
customerRouter.get('/customers/:customerId', requireAuth, controller.get);
customerRouter.patch('/customers/:customerId', requireAuth, controller.update);
customerRouter.delete('/customers/:customerId', requireAuth, controller.remove);
