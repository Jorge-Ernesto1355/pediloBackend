import { describe, expect, it } from 'vitest';
import {
  confirmDeliveryQuote,
  type DeliverySettings,
  isDeliveryAvailable,
} from './deliverySettings.js';
import { DeliveryFeeChangedError, DeliveryOutOfRangeError } from './errors/DeliveryErrors.js';

const origin = { latitude: 23.2494, longitude: -106.4111 };
// Valores solo de prueba: Pedilo no trae tarifas precargadas.
const settings: DeliverySettings = {
  enabled: true,
  origin,
  maxDeliveryKm: 5,
  feeConfig: { type: 'DISTANCE_TIERS', tiers: [{ upToKm: 5, fee: 40 }] },
};

describe('confirmación del envío al crear el pedido', () => {
  it('acepta cuando el envío coincide con el que vio el cliente', () => {
    expect(confirmDeliveryQuote(settings, origin, 40)).toMatchObject({ fee: 40, distanceKm: 0 });
  });

  it('tolera diferencias menores a un centavo', () => {
    expect(confirmDeliveryQuote(settings, origin, 40.004).fee).toBe(40);
  });

  it('rechaza si el envío cambió e informa el envío nuevo', () => {
    expect(() => confirmDeliveryQuote(settings, origin, 35)).toThrow(DeliveryFeeChangedError);
    try {
      confirmDeliveryQuote(settings, origin, 35);
    } catch (error) {
      expect((error as DeliveryFeeChangedError).details).toEqual({
        expectedDeliveryFee: 35,
        currentDeliveryFee: 40,
        distanceKm: 0,
      });
      expect((error as DeliveryFeeChangedError).statusCode).toBe(409);
    }
  });

  it('fuera de radio gana sobre el cambio de envío', () => {
    expect(() =>
      confirmDeliveryQuote(settings, { latitude: 23.3, longitude: -106.4111 }, 40),
    ).toThrow(DeliveryOutOfRangeError);
  });
});

describe('disponibilidad en el checkout', () => {
  it('solo está disponible con configuración completa y activa', () => {
    expect(isDeliveryAvailable(settings)).toBe(true);
    expect(isDeliveryAvailable({ ...settings, enabled: false })).toBe(false);
    expect(isDeliveryAvailable({ ...settings, origin: null })).toBe(false);
    expect(isDeliveryAvailable({ ...settings, feeConfig: null })).toBe(false);
    expect(isDeliveryAvailable({ ...settings, maxDeliveryKm: 8 })).toBe(false);
  });
});
