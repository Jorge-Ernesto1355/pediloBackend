import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { InventoryService } from '../../application/services/InventoryService.js';
import { PrismaInventoryRepository } from '../../infrastructure/persistence/PrismaInventoryRepository.js';
import { publishStockAlerts } from '../../infrastructure/stockAlertPublisher.js';
import { InventoryController } from './InventoryController.js';

const controller = new InventoryController(
  new InventoryService(new PrismaInventoryRepository(prisma), { publish: publishStockAlerts }),
);
const requireAuth = createRequireAuth(authProvider);

export const inventoryRouter = Router();
const base = '/:businessId/inventory';
inventoryRouter.get(`${base}/ingredients`, requireAuth, controller.listIngredients);
inventoryRouter.post(`${base}/ingredients`, requireAuth, controller.createIngredient);
inventoryRouter.patch(
  `${base}/ingredients/:ingredientId`,
  requireAuth,
  controller.updateIngredient,
);
inventoryRouter.delete(
  `${base}/ingredients/:ingredientId`,
  requireAuth,
  controller.archiveIngredient,
);
inventoryRouter.post(
  `${base}/ingredients/:ingredientId/movements`,
  requireAuth,
  controller.recordMovement,
);
inventoryRouter.get(
  `${base}/ingredients/:ingredientId/movements`,
  requireAuth,
  controller.listMovements,
);
inventoryRouter.get(`${base}/recipes/:kind/:targetId`, requireAuth, controller.getRecipe);
inventoryRouter.put(`${base}/recipes/:kind/:targetId`, requireAuth, controller.setRecipe);
inventoryRouter.get(`${base}/settings`, requireAuth, controller.getSettings);
inventoryRouter.patch(`${base}/settings`, requireAuth, controller.updateSettings);
inventoryRouter.get(`${base}/alerts`, requireAuth, controller.listAlerts);
