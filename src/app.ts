import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { toNodeHandler } from 'better-auth/node';

import { authRouter } from './modules/auth/presentation/http/auht.routes';
import { auth } from './libs/auth';
export function createApp() {
  const app = express();

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

  app.get('/health', (_req, res) => res.json({ status: 'ok' }));

  return app;
}
