import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { publicDeliveryRouter, QUOTE_RATE_LIMIT } from './delivery-settings.routes.js';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/public', publicDeliveryRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('límite de peticiones de la cotización pública', () => {
  it(`responde 429 después de ${QUOTE_RATE_LIMIT.limit} peticiones por IP en la ventana`, async () => {
    // Cuerpo sin pin: cada petición se rechaza en validación (400) sin tocar la base.
    const send = () =>
      fetch(`${baseUrl}/api/v1/public/businesses/biz-1/delivery/quote`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      });

    for (let index = 0; index < QUOTE_RATE_LIMIT.limit; index += 1) {
      expect((await send()).status).toBe(400);
    }
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).not.toBeNull();
  });
});
