import { describe, expect, it } from 'vitest';
import {
  calculateDeliveryFee,
  type DeliveryFeeConfig,
  maxCoveredKm,
  parseFeeConfig,
  validateFeeConfig,
} from './feePolicy.js';

// Valores solo de prueba: Pedilo no trae tarifas precargadas.
const config: DeliveryFeeConfig = {
  type: 'DISTANCE_TIERS',
  tiers: [
    { upToKm: 2, fee: 30 },
    { upToKm: 4, fee: 45 },
    { upToKm: 6, fee: 60 },
  ],
};

describe('tarifa por tramos de km', () => {
  it('el límite de cada tramo es inclusivo', () => {
    expect(calculateDeliveryFee(config, 2)).toBe(30);
    expect(calculateDeliveryFee(config, 4)).toBe(45);
    expect(calculateDeliveryFee(config, 6)).toBe(60);
  });

  it('0.1 km después del límite cae en el siguiente tramo', () => {
    expect(calculateDeliveryFee(config, 2.1)).toBe(45);
    expect(calculateDeliveryFee(config, 4.1)).toBe(60);
  });

  it('cobra el primer tramo desde 0 km', () => {
    expect(calculateDeliveryFee(config, 0)).toBe(30);
  });

  it('devuelve null si ningún tramo cubre la distancia', () => {
    expect(calculateDeliveryFee(config, 6.1)).toBeNull();
  });

  it('expone la distancia máxima cubierta', () => {
    expect(maxCoveredKm(config)).toBe(6);
  });
});

describe('validación de la tarifa', () => {
  it('acepta una tarifa válida', () => {
    expect(validateFeeConfig(config)).toEqual([]);
  });

  it('exige al menos un tramo', () => {
    expect(validateFeeConfig({ type: 'DISTANCE_TIERS', tiers: [] })).toContain('NO_TIERS');
  });

  it('exige tramos en orden ascendente sin repetir km', () => {
    const issues = validateFeeConfig({
      type: 'DISTANCE_TIERS',
      tiers: [
        { upToKm: 3, fee: 30 },
        { upToKm: 3, fee: 40 },
      ],
    });
    expect(issues).toContain('TIER_KM_NOT_ASCENDING');
  });

  it('rechaza km con más de 1 decimal, cero o mayores al límite', () => {
    for (const upToKm of [2.05, 0, -1, 51]) {
      expect(validateFeeConfig({ type: 'DISTANCE_TIERS', tiers: [{ upToKm, fee: 30 }] })).toContain(
        'TIER_KM_INVALID',
      );
    }
  });

  it('rechaza envíos en cero, con más de 2 decimales o mayores al límite', () => {
    for (const fee of [0, 30.555, 5001]) {
      expect(validateFeeConfig({ type: 'DISTANCE_TIERS', tiers: [{ upToKm: 2, fee }] })).toContain(
        'TIER_FEE_INVALID',
      );
    }
  });

  it('rechaza más de 10 tramos', () => {
    const tiers = Array.from({ length: 11 }, (_, index) => ({ upToKm: index + 1, fee: 10 }));
    expect(validateFeeConfig({ type: 'DISTANCE_TIERS', tiers })).toContain('TOO_MANY_TIERS');
  });
});

describe('lectura del JSON guardado', () => {
  it('lee una tarifa por tramos', () => {
    expect(parseFeeConfig(JSON.parse(JSON.stringify(config)))).toEqual(config);
  });

  it('devuelve null para valores vacíos o con forma desconocida', () => {
    expect(parseFeeConfig(null)).toBeNull();
    expect(parseFeeConfig({ type: 'FORMULA', base: 30 })).toBeNull();
    expect(
      parseFeeConfig({ type: 'DISTANCE_TIERS', tiers: [{ upToKm: '2', fee: 30 }] }),
    ).toBeNull();
  });
});
