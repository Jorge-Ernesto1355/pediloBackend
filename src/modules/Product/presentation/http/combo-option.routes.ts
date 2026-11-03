import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { ManageComboOptions } from '../../application/useCases/ManageComboOptions.js';
import { PrismaComboOptionRepository } from '../../infrastructure/persistence/PrismaComboOptionRepository.js';
import { ComboOptionController } from './ComboOptionController.js';

const repository = new PrismaComboOptionRepository(prisma);
const controller = new ComboOptionController(new ManageComboOptions(repository));
const requireAuth = createRequireAuth(authProvider);

export const comboOptionRouter = Router();
comboOptionRouter.post(
  '/products/:productId/combo-included-products',
  requireAuth,
  controller.addIncludedProduct,
);
comboOptionRouter.delete(
  '/products/:productId/combo-included-products/:includedProductId',
  requireAuth,
  controller.removeIncludedProduct,
);
comboOptionRouter.get('/products/:productId/combo-option-groups', requireAuth, controller.getCombo);
comboOptionRouter.post(
  '/products/:productId/combo-option-groups',
  requireAuth,
  controller.createGroup,
);
comboOptionRouter.patch(
  '/products/:productId/combo-option-groups/:groupId',
  requireAuth,
  controller.updateGroup,
);
comboOptionRouter.post(
  '/products/:productId/combo-option-groups/:groupId/products',
  requireAuth,
  controller.addProduct,
);
comboOptionRouter.delete(
  '/products/:productId/combo-option-groups/:groupId/products/:choiceProductId',
  requireAuth,
  controller.removeProduct,
);
comboOptionRouter.delete(
  '/products/:productId/combo-option-groups/:groupId',
  requireAuth,
  controller.deleteGroup,
);
