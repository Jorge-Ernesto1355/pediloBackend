import { Router, type Request, type Response } from 'express';
import { prisma } from '@/libs/prisma.js';
import { PrismaOrderRepository } from '../../infrastructure/persistence/PrismaOrderRepository.js';
import { ResolveOrderEventsRestaurant } from '../../application/useCases/ResolveOrderEventsRestaurant.js';
import { authProvider } from '@/modules/auth/presentation/http/auth.dependencies.js';
import { createRequireAuth } from '@/shared/config/authentication/auth.middleware.js';
import { orderEventHub } from '../../infrastructure/sse/OrderEventHub.js';
import { trustedOrigins } from '@/shared/config/env.js';

const requireAuth = createRequireAuth(authProvider);
const resolveRestaurant = new ResolveOrderEventsRestaurant(new PrismaOrderRepository(prisma));
export const orderEventsRouter = Router();

orderEventsRouter.get('/events', requireAuth, async (request: Request, response: Response) => {
  const userId = request.user?.id;
  if (!userId) {
    response
      .status(401)
      .json({ error: { code: 'NOT_AUTHENTICATED', message: 'User is not authenticated' } });
    return;
  }

  const origin = request.get('origin')?.trim().replace(/\/$/, '');
  if (origin && !trustedOrigins.includes(origin)) {
    response
      .status(403)
      .json({ error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed' } });
    return;
  }

  try {
    const restaurantId = await resolveRestaurant.execute(userId);
    if (!restaurantId) {
      response.status(403).json({
        error: {
          code: 'BUSINESS_ACCESS_DENIED',
          message: 'You do not have access to order events',
        },
      });
      return;
    }

    if (!orderEventHub.canAccept(restaurantId, userId)) {
      response.status(429).json({
        error: {
          code: 'TOO_MANY_EVENT_CONNECTIONS',
          message: 'Too many active order event connections',
        },
      });
      return;
    }

    response.status(200);
    response.set({
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    response.flushHeaders();
    response.write('retry: 3000\n: connected\n\n');

    const cleanup = orderEventHub.add(restaurantId, userId, response);
    if (!cleanup) {
      response.end();
      return;
    }
  } catch {
    if (!response.headersSent)
      response.status(503).json({
        error: {
          code: 'ORDER_EVENTS_UNAVAILABLE',
          message: 'Order events are temporarily unavailable',
        },
      });
    else response.end();
  }
});
