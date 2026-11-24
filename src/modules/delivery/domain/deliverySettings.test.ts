import { describe, expect, it } from 'vitest';
import {
  type DeliverySettings,
  quoteDelivery,
  validateDeliverySettings,
} from './deliverySettings.js';
import { type Coordinates, ROUTE_FACTOR } from './distance.js';
import {
  DeliveryDestinationInvalidError,
  DeliveryNotConfiguredError,
  DeliveryOutOfRangeError,
  DeliveryUnavailableError,
} from './errors/DeliveryErrors.js';

const EARTH_RADIUS_KM = 6371.0088;
const origin: Coordinates = { latitude: 23.2494, longitude: -106.4111 };

/** Punto al norte del origen cuya distancia de envío (× factor de ruta) es `roadKm`. */
function pointAtRoadKm(roadKm: number): Coordinates {
  const straightKm = roadKm / ROUTE_FACTOR;
  return {
    latitude: origin.latitude + ((straightKm / EARTH_RADIUS_KM) * 180) / Math.PI,
    longitude: origin.longitude,
  };
}

// Valores solo de prueba: Pedilo no trae tarifas precargadas.
const settings: DeliverySettings = {
  enabled: true,
  origin,
  maxDeliveryKm: 6,
  feeConfig: {
    type: 'DISTANCE_TIERS',
    tiers: [
      { upToKm: 2, fee: 30 },
      { upToKm: 4, fee: 45 },
      { upToKm: 6, fee: 60 },
    ],
  },
};

describe('cotización de envío', () => {
  it('devuelve distancia, envío y radio máximo', () => {
    expect(quoteDelivery(settings, pointAtRoadKm(3.4))).toEqual({
      distanceKm: 3.4,
      fee: 45,
      maxDeliveryKm: 6,
    });
  });

  it('una distancia exactamente en el límite de un tramo usa ese tramo', () => {
    expect(quoteDelivery(settings, pointAtRoadKm(2)).fee).toBe(30);
    expect(quoteDelivery(settings, pointAtRoadKm(2.1)).fee).toBe(45);
  });

  it('redondea a 1 decimal antes de comparar con los tramos', () => {
    // 2.04 km → 2.0 km → primer tramo; 2.06 km → 2.1 km → segundo tramo.
    expect(quoteDelivery(settings, pointAtRoadKm(2.04))).toMatchObject({ distanceKm: 2, fee: 30 });
    expect(quoteDelivery(settings, pointAtRoadKm(2.06))).toMatchObject({
      distanceKm: 2.1,
      fee: 45,
    });
  });

  it('acepta una distancia exactamente igual al radio máximo', () => {
    expect(quoteDelivery(settings, pointAtRoadKm(6))).toMatchObject({ distanceKm: 6, fee: 60 });
    expect(quoteDelivery(settings, pointAtRoadKm(6.04))).toMatchObject({ distanceKm: 6, fee: 60 });
  });

  it('rechaza una distancia mayor al radio máximo con distancia y radio en el error', () => {
    const attempt = () => quoteDelivery(settings, pointAtRoadKm(6.1));
    expect(attempt).toThrow(DeliveryOutOfRangeError);
    try {
      attempt();
    } catch (error) {
      expect((error as DeliveryOutOfRangeError).details).toEqual({
        distanceKm: 6.1,
        maxDeliveryKm: 6,
      });
      expect((error as DeliveryOutOfRangeError).statusCode).toBe(422);
    }
  });

  it('rechaza cuando el envío está desactivado', () => {
    expect(() => quoteDelivery({ ...settings, enabled: false }, pointAtRoadKm(1))).toThrow(
      DeliveryUnavailableError,
    );
  });

  it('rechaza cuando falta la ubicación del restaurante', () => {
    expect(() => quoteDelivery({ ...settings, origin: null }, pointAtRoadKm(1))).toThrow(
      DeliveryNotConfiguredError,
    );
  });

  it('rechaza cuando falta el radio o la tarifa', () => {
    expect(() => quoteDelivery({ ...settings, maxDeliveryKm: null }, pointAtRoadKm(1))).toThrow(
      DeliveryNotConfiguredError,
    );
    expect(() => quoteDelivery({ ...settings, feeConfig: null }, pointAtRoadKm(1))).toThrow(
      DeliveryNotConfiguredError,
    );
  });

  it('rechaza un pin del cliente inválido', () => {
    expect(() => quoteDelivery(settings, { latitude: 95, longitude: 0 })).toThrow(
      DeliveryDestinationInvalidError,
    );
    expect(() => quoteDelivery(settings, { latitude: Number.NaN, longitude: 0 })).toThrow(
      DeliveryDestinationInvalidError,
    );
  });
});

describe('validación de la configuración', () => {
  it('acepta una configuración completa', () => {
    expect(validateDeliverySettings(settings)).toEqual([]);
  });

  it('permite guardar desactivado e incompleto', () => {
    expect(
      validateDeliverySettings({
        enabled: false,
        origin: null,
        maxDeliveryKm: null,
        feeConfig: null,
      }),
    ).toEqual([]);
  });

  it('activar exige ubicación, radio y tarifa', () => {
    expect(
      validateDeliverySettings({
        enabled: true,
        origin: null,
        maxDeliveryKm: null,
        feeConfig: null,
      }),
    ).toEqual(expect.arrayContaining(['ORIGIN_MISSING', 'MAX_KM_MISSING', 'NO_TIERS']));
  });

  it('el último tramo debe cubrir el radio máximo', () => {
    expect(validateDeliverySettings({ ...settings, maxDeliveryKm: 6.5 })).toContain(
      'TIERS_DO_NOT_COVER_MAX_KM',
    );
    expect(validateDeliverySettings({ ...settings, maxDeliveryKm: 5 })).toEqual([]);
  });

  it('el radio debe ser positivo, con 1 decimal y hasta 50 km', () => {
    for (const maxDeliveryKm of [0, 2.55, 51]) {
      expect(validateDeliverySettings({ ...settings, maxDeliveryKm })).toContain('MAX_KM_INVALID');
    }
  });
});
