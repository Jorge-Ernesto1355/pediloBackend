import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateMenu } from '../../application/useCases/CreateMenu.js';
import { DeleteMenu } from '../../application/useCases/DeleteMenu.js';
import { GetMenu } from '../../application/useCases/GetMenu.js';
import { ListMenus } from '../../application/useCases/ListMenus.js';
import { SetMenuActive } from '../../application/useCases/SetMenuActive.js';
import { UpdateMenu } from '../../application/useCases/UpdateMenu.js';
import { PrismaMenuRepository } from '../../infrastructure/persistence/PrismaMenuRepository.js';
import { MenuController } from './MenuController.js';
import { noConditionalCatalogCache } from './menu-cache.middleware.js';

const repository = new PrismaMenuRepository(prisma);
const controller = new MenuController(
  new CreateMenu(repository),
  new GetMenu(repository),
  new ListMenus(repository),
  new UpdateMenu(repository),
  new DeleteMenu(repository),
  new SetMenuActive(repository),
);
const requireAuth = createRequireAuth(authProvider);

export const menuRouter = Router();
menuRouter.post('/:businessId/menus', requireAuth, controller.create);
menuRouter.get('/mine/menus', requireAuth, noConditionalCatalogCache, controller.list);
menuRouter.get('/:businessId/menus', requireAuth, controller.list);
menuRouter.get('/menus/:id', requireAuth, controller.get);
menuRouter.patch('/menus/:id', requireAuth, controller.update);
menuRouter.patch('/menus/:id/status', requireAuth, controller.setActive);
menuRouter.delete('/menus/:id', requireAuth, controller.remove);
