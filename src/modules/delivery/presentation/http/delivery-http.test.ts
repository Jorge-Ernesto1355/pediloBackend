import { createServer, type Server } from 'node:http';
import express from 'express';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { DeliverySettingsRepository } from '../../application/ports/DeliverySettingsRepository.js';
import { GetDeliverySettings } from '../../application/useCases/GetDeliverySettings.js';
import { QuoteDelivery } from '../../application/useCases/QuoteDelivery.js';
import { UpdateDeliverySettings } from '../../application/useCases/UpdateDeliverySettings.js';
import { DeliverySettingsController } from './DeliverySettingsController.js';
import { updateDeliverySettingsSchema } from './delivery.schemas.js';

const origin = { latitude: 23.2494, longitude: -106.4111 };
const repository: DeliverySettingsRepository = {
  findBusinessIdByUserId: vi.fn(async () => 'biz-1'),
  getByBusinessId: vi.fn(async (businessId: string) =>
    businessId === 'biz-1'
      ? {
          enabled: true,
          origin,
          maxDeliveryKm: 1,
          feeConfig: { type: 'DISTANCE_TIERS' as const, tiers: [{ upToKm: 1, fee: 25 }] },
        }
      : null,
  ),
  save: vi.fn(),
};

const controller = new DeliverySettingsController(
  new GetDeliverySettings(repository),
  new UpdateDeliverySettings(repository),
  new QuoteDelivery(repository),
);

let server: Server;
let baseUrl = '';

beforeAll(async () => {
  const app = express();
  app.use(express.json());
  app.post('/businesses/:businessId/delivery/quote', controller.quote);
  server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${typeof address === 'object' && address ? address.port : 0}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function quote(businessId: string, body: unknown) {
  return fetch(`${baseUrl}/businesses/${businessId}/delivery/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /delivery/quote', () => {
  it('responde distancia y envío calculados en el servidor', async () => {
    const response = await quote('biz-1', origin);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ quote: { distanceKm: 0, fee: 25, maxDeliveryKm: 1 } });
  });

  it('sin pin responde DELIVERY_DESTINATION_INVALID', async () => {
    const response = await quote('biz-1', {});
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe('DELIVERY_DESTINATION_INVALID');
  });

  it('ignora cualquier distancia o envío que mande el cliente (los rechaza)', async () => {
    const response = await quote('biz-1', { ...origin, distanceKm: 0.1, fee: 1 });
    expect(response.status).toBe(400);
  });

  it('fuera de radio responde 422 con distancia y radio', async () => {
    const response = await quote('biz-1', { latitude: 23.3, longitude: -106.4111 });
    expect(response.status).toBe(422);
    const body = await response.json();
    expect(body.error.code).toBe('DELIVERY_OUT_OF_RANGE');
    expect(body.error.details.maxDeliveryKm).toBe(1);
    expect(body.error.details.distanceKm).toBeGreaterThan(1);
  });

  it('negocio inexistente responde 404', async () => {
    const response = await quote('missing', origin);
    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe('BUSINESS_NOT_FOUND');
  });
});

describe('validación de PUT /delivery-settings', () => {
  const valid = {
    enabled: true,
    maxDeliveryKm: 5,
    feeConfig: { type: 'DISTANCE_TIERS', tiers: [{ upToKm: 5, fee: 40 }] },
  };

  it('acepta una configuración por tramos', () => {
    expect(updateDeliverySettingsSchema.safeParse(valid).success).toBe(true);
    expect(updateDeliverySettingsSchema.safeParse({ ...valid, origin }).success).toBe(true);
  });

  it('rechaza campos desconocidos y tipos de tarifa no soportados', () => {
    expect(updateDeliverySettingsSchema.safeParse({ ...valid, extra: 1 }).success).toBe(false);
    expect(
      updateDeliverySettingsSchema.safeParse({ ...valid, feeConfig: { type: 'FORMULA' } }).success,
    ).toBe(false);
  });

  it('rechaza coordenadas fuera de rango', () => {
    expect(
      updateDeliverySettingsSchema.safeParse({ ...valid, origin: { latitude: 100, longitude: 0 } })
        .success,
    ).toBe(false);
  });
});
