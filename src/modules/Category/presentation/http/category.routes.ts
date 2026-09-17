import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateCategory } from '../../application/useCases/CreateCategory.js';
import { DeleteCategory } from '../../application/useCases/DeleteCategory.js';
import { GetCategory } from '../../application/useCases/GetCategory.js';
import { MoveAllProductsAndDeleteCategory } from '../../application/useCases/MoveAllProductsAndDeleteCategory.js';
import { ReorderCategories } from '../../application/useCases/ReorderCategories.js';
import { SetCategoryActive } from '../../application/useCases/SetCategoryActive.js';
import { UpdateCategory } from '../../application/useCases/UpdateCategory.js';
import { PrismaCategoryRepository } from '../../infrastructure/persistence/PrismaCategoryRepository.js';
import { CategoryController } from './CategoryController.js';

const repository = new PrismaCategoryRepository(prisma);
const controller = new CategoryController(
  new CreateCategory(repository),
  new GetCategory(repository),
  new UpdateCategory(repository),
  new DeleteCategory(repository),
  new SetCategoryActive(repository),
  new ReorderCategories(repository),
  new MoveAllProductsAndDeleteCategory(repository),
);
const requireAuth = createRequireAuth(authProvider);

export const categoryRouter = Router();
categoryRouter.post('/:businessId/categories', requireAuth, controller.create);
categoryRouter.post('/menus/:menuId/categories/reorder', requireAuth, controller.reorder);
categoryRouter.post(
  '/categories/:id/move-products-and-delete',
  requireAuth,
  controller.moveAllAndDelete,
);
categoryRouter.get('/categories/:id', requireAuth, controller.get);
categoryRouter.patch('/categories/:id', requireAuth, controller.update);
categoryRouter.patch('/categories/:id/status', requireAuth, controller.setActive);
categoryRouter.delete('/categories/:id', requireAuth, controller.remove);
