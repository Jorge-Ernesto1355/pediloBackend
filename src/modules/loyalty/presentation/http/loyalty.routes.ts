import { Router } from 'express';
import { prisma } from '@/libs/prisma.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import {
  GetLoyaltyCard,
  GetLoyaltySummary,
  GetPublicLoyaltyCard,
  GetPublicLoyaltyProgram,
  ListLoyaltyCards,
  QuoteLoyaltyReward,
  RotateLoyaltyCardToken,
} from '../../application/useCases/cardUseCases.js';
import {
  GetLoyaltyProgram,
  SaveLoyaltyProgram,
} from '../../application/useCases/programUseCases.js';
import {
  AddWalkInStamp,
  RedeemLoyaltyReward,
  StampOrder,
  VoidLoyaltyStamp,
  VoidOrderStamp,
} from '../../application/useCases/stampUseCases.js';
import { PrismaLoyaltyRepository } from '../../infrastructure/persistence/PrismaLoyaltyRepository.js';
import { LoyaltyController } from './LoyaltyController.js';
import {
  byBodyToken,
  byIp,
  byTokenParam,
  loyaltyRateLimit,
  PUBLIC_LOYALTY_RATE_LIMITS as LIMITS,
} from './loyaltyRateLimit.js';

const repository = new PrismaLoyaltyRepository(prisma);
const controller = new LoyaltyController({
  getProgram: new GetLoyaltyProgram(repository),
  saveProgram: new SaveLoyaltyProgram(repository),
  listCards: new ListLoyaltyCards(repository),
  summary: new GetLoyaltySummary(repository),
  getCard: new GetLoyaltyCard(repository),
  rotateToken: new RotateLoyaltyCardToken(repository),
  stampOrder: new StampOrder(repository),
  voidOrderStamp: new VoidOrderStamp(repository),
  voidStamp: new VoidLoyaltyStamp(repository),
  walkInStamp: new AddWalkInStamp(repository),
  redeemReward: new RedeemLoyaltyReward(repository),
  publicCard: new GetPublicLoyaltyCard(repository),
  publicProgram: new GetPublicLoyaltyProgram(repository),
  quoteReward: new QuoteLoyaltyReward(repository),
});
const requireAuth = createRequireAuth(authProvider);

/**
 * Dueño, montado en /api/v1/businesses (antes de businessRouter). El restaurante sale
 * siempre de la sesión. El token de la tarjeta nunca se acepta en estas rutas.
 */
export const loyaltyRouter = Router();
loyaltyRouter.get('/loyalty/program', requireAuth, controller.getProgram);
loyaltyRouter.put('/loyalty/program', requireAuth, controller.saveProgram);
loyaltyRouter.get('/loyalty/summary', requireAuth, controller.summary);
loyaltyRouter.get('/loyalty/cards', requireAuth, controller.listCards);
loyaltyRouter.get('/loyalty/cards/:customerId', requireAuth, controller.getCard);
loyaltyRouter.post('/loyalty/cards/:customerId/rotate-token', requireAuth, controller.rotateToken);
loyaltyRouter.post('/loyalty/customers/:customerId/stamps', requireAuth, controller.walkInStamp);
loyaltyRouter.post('/loyalty/stamps/:stampId/void', requireAuth, controller.voidStamp);
loyaltyRouter.post('/loyalty/rewards/:rewardId/redeem', requireAuth, controller.redeemReward);
loyaltyRouter.post('/orders/:orderId/stamp', requireAuth, controller.stampOrder);
loyaltyRouter.delete('/orders/:orderId/stamp', requireAuth, controller.voidOrderStamp);

/** Público, montado en /api/v1/public. Límite por IP y por token. */
export const publicLoyaltyRouter = Router();
publicLoyaltyRouter.get(
  '/loyalty/:token',
  loyaltyRateLimit(LIMITS.cardByIp.limit, LIMITS.cardByIp.windowMs, byIp),
  loyaltyRateLimit(LIMITS.cardByToken.limit, LIMITS.cardByToken.windowMs, byTokenParam),
  controller.publicCard,
);
publicLoyaltyRouter.get(
  '/businesses/:slug/loyalty',
  loyaltyRateLimit(LIMITS.programByIp.limit, LIMITS.programByIp.windowMs, byIp),
  controller.publicProgram,
);
publicLoyaltyRouter.post(
  '/businesses/:slug/loyalty/reward-quote',
  loyaltyRateLimit(LIMITS.quoteByIp.limit, LIMITS.quoteByIp.windowMs, byIp),
  loyaltyRateLimit(LIMITS.quoteByToken.limit, LIMITS.quoteByToken.windowMs, byBodyToken),
  controller.quoteReward,
);
