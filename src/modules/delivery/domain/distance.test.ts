import { describe, expect, it } from 'vitest';
import {
  deliveryDistanceKm,
  haversineKm,
  isValidCoordinates,
  ROUTE_FACTOR,
  roundDistanceKm,
} from './distance.js';

const mazatlan = { latitude: 23.2494, longitude: -106.4111 };

describe('distancia de envío', () => {
  it('usa un factor de ruta de 1.3', () => {
    expect(ROUTE_FACTOR).toBe(1.3);
  });

  it('calcula 0 km para el mismo punto', () => {
    expect(haversineKm(mazatlan, mazatlan)).toBe(0);
    expect(deliveryDistanceKm(mazatlan, mazatlan)).toBe(0);
  });

  it('calcula ~111.2 km por grado de latitud', () => {
    const north = { latitude: 24.2494, longitude: -106.4111 };
    expect(haversineKm(mazatlan, north)).toBeCloseTo(111.195, 2);
  });

  it('es simétrica', () => {
    const other = { latitude: 23.2301, longitude: -106.4302 };
    expect(haversineKm(mazatlan, other)).toBeCloseTo(haversineKm(other, mazatlan), 10);
  });

  it('multiplica la línea recta por el factor de ruta y redondea a 1 decimal', () => {
    const other = { latitude: 23.27, longitude: -106.43 };
    const straight = haversineKm(mazatlan, other);
    expect(deliveryDistanceKm(mazatlan, other)).toBe(roundDistanceKm(straight * 1.3));
    expect(deliveryDistanceKm(mazatlan, other) * 10).toBe(
      Math.round(deliveryDistanceKm(mazatlan, other) * 10),
    );
  });

  it('redondea a 1 decimal con mitad hacia arriba', () => {
    expect(roundDistanceKm(2.04)).toBe(2);
    expect(roundDistanceKm(2.05)).toBe(2.1);
    expect(roundDistanceKm(2.0499)).toBe(2);
    expect(roundDistanceKm(5.95)).toBe(6);
  });

  it('valida rangos de coordenadas', () => {
    expect(isValidCoordinates(mazatlan)).toBe(true);
    expect(isValidCoordinates({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinates({ latitude: 0, longitude: -181 })).toBe(false);
    expect(isValidCoordinates({ latitude: Number.NaN, longitude: 0 })).toBe(false);
  });
});
