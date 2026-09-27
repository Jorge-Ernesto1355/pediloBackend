import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { CreateBusinessSettings } from '../../application/useCases/CreateBusinessSettings.js';
import { GetBusinessSettings } from '../../application/useCases/GetBusinessSettings.js';
import { UpdateBusinessSettings } from '../../application/useCases/UpdateBusinessSettings.js';
import { PrismaBusinessSettingsRepository } from '../../infrastructure/persistence/PrismaBusinessSettingsRepository.js';
import { BusinessSettingsController } from './BusinessSettingsController.js';

const repository = new PrismaBusinessSettingsRepository(prisma);
const controller = new BusinessSettingsController(
  new GetBusinessSettings(repository),
  new CreateBusinessSettings(repository),
  new UpdateBusinessSettings(repository),
);
const requireAuth = createRequireAuth(authProvider);

export const businessSettingsRouter = Router();
businessSettingsRouter.get('/settings', requireAuth, controller.get);
businessSettingsRouter.post('/settings', requireAuth, controller.create);
businessSettingsRouter.patch('/settings', requireAuth, controller.update);
