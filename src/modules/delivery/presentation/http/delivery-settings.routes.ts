import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { PasswordRecoveryRateLimiter } from '@/modules/auth/presentation/http/passwordRecoveryRateLimiter.js';
import { GetDeliverySettings } from '../../application/useCases/GetDeliverySettings.js';
import { QuoteDelivery } from '../../application/useCases/QuoteDelivery.js';
import { UpdateDeliverySettings } from '../../application/useCases/UpdateDeliverySettings.js';
import { PrismaDeliverySettingsRepository } from '../../infrastructure/persistence/PrismaDeliverySettingsRepository.js';
import { DeliverySettingsController } from './DeliverySettingsController.js';

const repository = new PrismaDeliverySettingsRepository(prisma);
const controller = new DeliverySettingsController(
  new GetDeliverySettings(repository),
  new UpdateDeliverySettings(repository),
  new QuoteDelivery(repository),
);
const requireAuth = createRequireAuth(authProvider);

/** Montado en /api/v1/businesses (antes de businessRouter, que tiene GET /:id). */
export const deliverySettingsRouter = Router();
deliverySettingsRouter.get('/delivery-settings', requireAuth, controller.get);
deliverySettingsRouter.put('/delivery-settings', requireAuth, controller.update);

export const QUOTE_RATE_LIMIT = { limit: 60, windowMs: 60 * 1000 } as const;
const quoteRateLimiter = new PasswordRecoveryRateLimiter();

/** Montado en /api/v1/public. Sin sesión: lo usa el checkout del menú público. */
export const publicDeliveryRouter = Router();
publicDeliveryRouter.post(
  '/businesses/:businessId/delivery/quote',
  quoteRateLimiter.middleware(
    QUOTE_RATE_LIMIT.limit,
    QUOTE_RATE_LIMIT.windowMs,
    (request) => request.ip ?? 'unknown',
  ),
  controller.quote,
);
