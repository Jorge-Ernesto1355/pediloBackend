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
import { auth } from './libs/auth';
import { errorHandler } from './shared/errors/error-handler.js';
import { requestLogger, requestLoggerErrorHandler } from './shared/config/http/request-logger.js';
export function createApp() {
  const app = express();

  app.use(requestLogger);

  app.use(
    cors({
      origin: (process.env.TRUSTED_ORIGINS ?? '').split(',').filter(Boolean),
      credentials: true,
    }),
  );
  app.use(helmet());

  // Handler crudo de better-auth. Debe ir ANTES de express.json().
  app.all('/api/auth/*', toNodeHandler(auth));

  // A partir de aquí sí podemos parsear JSON para el resto de rutas.
  app.use(express.json());

  // Tu API hexagonal, construida sobre los casos de uso.
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/businesses', businessRouter);
  app.use('/api/v1/businesses', categoryRouter);
  app.use('/api/v1/businesses', menuRouter);
  app.use('/api/v1/businesses', productRouter);
  app.use('/api/v1/businesses', productOptionRouter);

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  app.use(requestLoggerErrorHandler);
  app.use(errorHandler);

  return app;
}
