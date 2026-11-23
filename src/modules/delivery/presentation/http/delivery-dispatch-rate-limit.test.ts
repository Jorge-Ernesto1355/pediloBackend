import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  PUBLIC_DELIVERY_RATE_LIMITS,
  publicDeliveryDispatchRouter,
} from './delivery-dispatch.routes.js';

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/public', publicDeliveryDispatchRouter);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('límite de peticiones al tomar entregas', () => {
  it(`responde 429 después de ${PUBLIC_DELIVERY_RATE_LIMITS.claim.limit} tomas por IP`, async () => {
    // Cuerpo inválido: cada intento se rechaza en validación (400) sin tocar la base.
    const send = () =>
      fetch(`${baseUrl}/api/v1/public/deliveries/offer/${'a'.repeat(43)}/claim`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'x', phone: '123' }),
      });
    for (let index = 0; index < PUBLIC_DELIVERY_RATE_LIMITS.claim.limit; index += 1) {
      expect((await send()).status).toBe(400);
    }
    const limited = await send();
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).not.toBeNull();
  });

  it('valida nombre y teléfono del repartidor (10 dígitos de México)', async () => {
    const { claimDeliverySchema } = await import('./deliveryDispatch.schemas.js');
    expect(claimDeliverySchema.safeParse({ name: 'Ana', phone: '669-999-0001' }).data).toEqual({
      name: 'Ana',
      phone: '6699990001',
    });
    expect(claimDeliverySchema.safeParse({ name: 'Ana', phone: '+52 669 999 0001' }).success).toBe(
      false,
    );
    expect(claimDeliverySchema.safeParse({ name: 'A', phone: '6699990001' }).success).toBe(false);
  });

  it('solo acepta los motivos de falla definidos', async () => {
    const { failDeliverySchema } = await import('./deliveryDispatch.schemas.js');
    for (const reason of ['CUSTOMER_UNREACHABLE', 'WRONG_ADDRESS', 'CUSTOMER_REJECTED', 'OTHER']) {
      expect(failDeliverySchema.safeParse({ reason }).success).toBe(true);
    }
    expect(failDeliverySchema.safeParse({ reason: 'LLUVIA' }).success).toBe(false);
  });
});
