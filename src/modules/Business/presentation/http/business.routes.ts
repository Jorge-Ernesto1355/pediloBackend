import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateBusiness } from '../../application/useCases/CreateBusiness.js';
import { DeleteBusiness } from '../../application/useCases/DeleteBusiness.js';
import { GetBusiness } from '../../application/useCases/GetBusiness.js';
import { ListBusinesses } from '../../application/useCases/ListBusinesses.js';
import { UpdateBusiness } from '../../application/useCases/UpdateBusiness.js';
import { PrismaBusinessRepository } from '../../infrastructure/persistence/PrismaBusinessRepository.js';
import { BusinessController } from './BusinessController.js';

const repository = new PrismaBusinessRepository(prisma);
const controller = new BusinessController(
  new CreateBusiness(repository),
  new GetBusiness(repository),
  new ListBusinesses(repository),
  new UpdateBusiness(repository),
  new DeleteBusiness(repository),
);
const requireAuth = createRequireAuth(authProvider);

export const businessRouter = Router();
businessRouter.get('/', controller.list);
businessRouter.get('/slug/:slug', controller.getBySlug);
businessRouter.get('/mine', requireAuth, controller.getMine);
businessRouter.post('/', requireAuth, controller.create);
businessRouter.get('/:id', controller.getById);
businessRouter.patch('/:id', requireAuth, controller.update);
businessRouter.delete('/:id', requireAuth, controller.delete);
