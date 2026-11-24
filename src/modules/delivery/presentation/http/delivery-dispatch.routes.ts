import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { PasswordRecoveryRateLimiter } from '@/modules/auth/presentation/http/passwordRecoveryRateLimiter.js';
import { ClaimDelivery } from '../../application/useCases/ClaimDelivery.js';
import { ConfirmOrderTransfer } from '../../application/useCases/ConfirmOrderTransfer.js';
import {
  CompleteDelivery,
  FailDelivery,
} from '../../application/useCases/CourierDeliveryActions.js';
import { CreateDeliveryOffer } from '../../application/useCases/CreateDeliveryOffer.js';
import { GetCourierDelivery } from '../../application/useCases/GetCourierDelivery.js';
import { GetDeliveryOffer } from '../../application/useCases/GetDeliveryOffer.js';
import { HandOffDelivery } from '../../application/useCases/HandOffDelivery.js';
import { ReleaseDelivery } from '../../application/useCases/ReleaseDelivery.js';
import {
  NoopOrderStatusNotifier,
  SseDeliveryEventPublisher,
} from '../../infrastructure/events/DeliveryEventAdapters.js';
import { PrismaDeliveryRepository } from '../../infrastructure/persistence/PrismaDeliveryRepository.js';
import { DeliveryDispatchController } from './DeliveryDispatchController.js';

const repository = new PrismaDeliveryRepository(prisma);
const events = new SseDeliveryEventPublisher();
const controller = new DeliveryDispatchController({
  createOffer: new CreateDeliveryOffer(repository, events),
  release: new ReleaseDelivery(repository, events),
  handOff: new HandOffDelivery(repository, events, new NoopOrderStatusNotifier()),
  confirmTransfer: new ConfirmOrderTransfer(repository),
  getOffer: new GetDeliveryOffer(repository),
  claim: new ClaimDelivery(repository, events),
  getCourierDelivery: new GetCourierDelivery(repository),
  complete: new CompleteDelivery(repository, events),
  fail: new FailDelivery(repository, events),
});
const requireAuth = createRequireAuth(authProvider);

/**
 * Dueño, montado en /api/v1/businesses (antes de businessRouter).
 * Cancelar el pedido sigue siendo PATCH /orders/:orderId/status { CANCELLED }:
 * ahora también cancela la entrega pendiente o tomada (y se rechaza si va en camino).
 */
export const deliveryDispatchRouter = Router();
deliveryDispatchRouter.post('/orders/:orderId/delivery', requireAuth, controller.createOffer);
deliveryDispatchRouter.post('/orders/:orderId/delivery/release', requireAuth, controller.release);
deliveryDispatchRouter.post('/orders/:orderId/delivery/handoff', requireAuth, controller.handOff);
deliveryDispatchRouter.patch(
  '/orders/:orderId/transfer-received',
  requireAuth,
  controller.confirmTransfer,
);

/**
 * Límites por IP de los endpoints públicos (sin cuenta, solo con el token del link).
 * Holgados a propósito: los repartidores usan datos móviles y varios pueden compartir
 * la misma IP pública (CGNAT); aun así frenan intentos masivos de adivinar tokens.
 */
export const PUBLIC_DELIVERY_RATE_LIMITS = {
  view: { limit: 120, windowMs: 60_000 },
  claim: { limit: 30, windowMs: 60_000 },
  courierAction: { limit: 30, windowMs: 60_000 },
} as const;

function limiter(config: { limit: number; windowMs: number }) {
  return new PasswordRecoveryRateLimiter().middleware(
    config.limit,
    config.windowMs,
    (request) => request.ip ?? 'unknown',
  );
}

const viewLimiter = limiter(PUBLIC_DELIVERY_RATE_LIMITS.view);
const claimLimiter = limiter(PUBLIC_DELIVERY_RATE_LIMITS.claim);
const courierActionLimiter = limiter(PUBLIC_DELIVERY_RATE_LIMITS.courierAction);

/** Repartidor, montado en /api/v1/public. */
export const publicDeliveryDispatchRouter = Router();
publicDeliveryDispatchRouter.get('/deliveries/offer/:token', viewLimiter, controller.getOffer);
publicDeliveryDispatchRouter.post('/deliveries/offer/:token/claim', claimLimiter, controller.claim);
publicDeliveryDispatchRouter.get(
  '/deliveries/courier/:token',
  viewLimiter,
  controller.getCourierDelivery,
);
publicDeliveryDispatchRouter.post(
  '/deliveries/courier/:token/delivered',
  courierActionLimiter,
  controller.complete,
);
publicDeliveryDispatchRouter.post(
  '/deliveries/courier/:token/failed',
  courierActionLimiter,
  controller.fail,
);
