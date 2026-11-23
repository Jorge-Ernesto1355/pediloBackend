import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { defaultLoyaltyDesign } from '../../domain/loyaltyDesign.js';
import { generateCardToken } from '../../domain/loyaltyTokens.js';
import { loyaltyProgramSchema } from './loyalty.schemas.js';
import { byTokenParam, loyaltyRateLimit } from './loyaltyRateLimit.js';

describe('esquema del programa', () => {
  const valid = {
    enabled: true,
    stampsRequired: 8,
    stampMode: 'MANUAL',
    minOrderAmount: 0,
    rewardType: 'PERCENT',
    rewardValue: 20,
    design: defaultLoyaltyDesign('Mi café'),
  };

  it('acepta el programa por defecto', () => {
    expect(loyaltyProgramSchema.safeParse(valid).success).toBe(true);
  });

  it.each([2, 21, 7.5])('rechaza %s sellos requeridos', (stampsRequired) => {
    expect(loyaltyProgramSchema.safeParse({ ...valid, stampsRequired }).success).toBe(false);
  });

  it('rechaza un porcentaje fuera de 1 a 100', () => {
    expect(loyaltyProgramSchema.safeParse({ ...valid, rewardValue: 0 }).success).toBe(false);
    expect(loyaltyProgramSchema.safeParse({ ...valid, rewardValue: 101 }).success).toBe(false);
  });

  it('producto gratis exige elegir un producto', () => {
    expect(
      loyaltyProgramSchema.safeParse({ ...valid, rewardType: 'FREE_PRODUCT', rewardValue: 0 })
        .success,
    ).toBe(false);
  });

  it('rechaza campos desconocidos y montos con más de dos decimales', () => {
    expect(loyaltyProgramSchema.safeParse({ ...valid, restaurantId: 'otro' }).success).toBe(false);
    expect(loyaltyProgramSchema.safeParse({ ...valid, minOrderAmount: 10.555 }).success).toBe(
      false,
    );
  });
});

describe('límite de peticiones por token', () => {
  let server: Server;
  let baseUrl = '';

  beforeAll(async () => {
    const app = express();
    app.get('/loyalty/:token', loyaltyRateLimit(3, 60_000, byTokenParam), (_request, response) => {
      response.json({ ok: true });
    });
    server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('responde 429 en español al pasar el límite y no afecta a otros tokens', async () => {
    const limitedToken = generateCardToken();
    for (let index = 0; index < 3; index += 1) {
      expect((await fetch(`${baseUrl}/loyalty/${limitedToken}`)).status).toBe(200);
    }
    const limited = await fetch(`${baseUrl}/loyalty/${limitedToken}`);
    expect(limited.status).toBe(429);
    expect(limited.headers.get('retry-after')).not.toBeNull();
    const body = (await limited.json()) as { error: { code: string; message: string } };
    expect(body.error.code).toBe('RATE_LIMITED');
    expect(body.error.message).toMatch(/Demasiadas solicitudes/);
    expect(JSON.stringify(body)).not.toContain(limitedToken);
    expect((await fetch(`${baseUrl}/loyalty/${generateCardToken()}`)).status).toBe(200);
  });
});
