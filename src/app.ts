import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';

import { authRouter } from './modules/auth/presentation/http/auht.routes';
import { businessRouter } from './modules/Business/presentation/http/business.routes.js';
import { categoryRouter } from './modules/Category/presentation/http/category.routes.js';
import { menuRouter } from './modules/Menu/presentation/http/menu.routes.js';
import { productRouter } from './modules/Product/presentation/http/product.routes.js';
import { productOptionRouter } from './modules/Product/presentation/http/product-option.routes.js';
import { publicBusinessRouter } from './modules/Business/presentation/http/public-business.routes.js';
import { storeVisitRouter } from './modules/Business/presentation/http/store-visit.routes.js';
import { auth } from './libs/auth';
import { errorHandler } from './shared/errors/error-handler.js';
import { customerRouter } from './modules/Customer/presentation/http/customer.routes.js';
import { orderRouter } from './modules/orders/presentation/http/order.routes.js';
import { requestLogger, requestLoggerErrorHandler } from './shared/config/http/request-logger.js';
import { salesRouter } from './modules/dashboard/presentation/http/sales.routes.js';
import { businessSettingsRouter } from './modules/Business/presentation/http/business-settings.routes.js';
import { accountRouter } from './modules/Account/presentation/http/account.routes.js';
import { env, trustedOrigins } from './shared/config/env.js';
import { trustedOriginGuard } from './shared/config/security/origin-guard.js';
import { PasswordRecoveryRateLimiter } from './modules/auth/presentation/http/passwordRecoveryRateLimiter.js';
import { analyticsRouter } from './modules/analytics/presentation/http/analytics.routes.js';
import {
  googleReviewRouter,
  googleReviewTrackingRouter,
} from './modules/GoogleReviews/presentation/http/google-review.routes.js';
export function createApp() {
  const app = express();
  // Render terminates TLS in its load balancer and forwards the client address.
  // Trust only that single proxy hop in deployed environments so request.ip
  // does not collapse every visitor into the load balancer's address.
  app.set('trust proxy', env.PEDILO_ENV === 'local' ? false : 1);
  const betterAuthRateLimiter = new PasswordRecoveryRateLimiter();

  app.use(requestLogger);

  app.use(
    cors({
      origin: trustedOrigins,
      credentials: true,
    }),
  );
  app.use(helmet());
  app.use(trustedOriginGuard);

  // Handler crudo de better-auth. Debe ir ANTES de express.json().
  app.use(
    '/api/auth',
    betterAuthRateLimiter.middleware(60, 15 * 60 * 1000, (request) => request.ip ?? 'unknown'),
  );
  app.all('/api/auth/*', toNodeHandler(auth));

  // A partir de aquí sí podemos parsear JSON para el resto de rutas.
  app.use(express.json());

  app.use('/r', googleReviewTrackingRouter);

  // Tu API hexagonal, construida sobre los casos de uso.
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/account', accountRouter);
  // Debe ir antes de businessRouter porque ese router contiene GET /:id.
  app.use('/api/v1/businesses', businessSettingsRouter);
  app.use('/api/v1/businesses', storeVisitRouter);
  app.use('/api/v1/businesses', googleReviewRouter);
  app.use('/api/v1/businesses', businessRouter);
  app.use('/api/v1/businesses', categoryRouter);
  app.use('/api/v1/businesses', menuRouter);
  app.use('/api/v1/businesses', productRouter);
  app.use('/api/v1/businesses', productOptionRouter);
  app.use('/api/v1/businesses', customerRouter);
  app.use('/api/v1/businesses', orderRouter);
  app.use('/api/v1/public', publicBusinessRouter);
  app.use('/api/v1/dashboard', salesRouter);
  app.use('/api/v1/analytics', analyticsRouter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use(requestLoggerErrorHandler);
  app.use(errorHandler);

  return app;
}
