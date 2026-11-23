import { describe, expect, it } from 'vitest';
import { approximateZone, cardinalDirection, neighborhoodLabel } from './approximateZone.js';
import { splitDeliveryMoney } from './deliveryMoney.js';
import {
  assertTransition,
  canTransition,
  type DeliveryStatus,
  isActive,
  isTerminal,
} from './deliveryStateMachine.js';
import {
  closedAt,
  COURIER_LINK_GRACE_MS,
  generateToken,
  hashToken,
  isCourierLinkExpired,
  isWellFormedToken,
  OFFER_TTL_MS,
  offerExpiresAt,
} from './deliveryTokens.js';
import { DeliveryInvalidTransitionError } from './errors/DeliveryErrors.js';

const statuses: DeliveryStatus[] = [
  'PENDING',
  'ACCEPTED',
  'PICKED_UP',
  'DELIVERED',
  'FAILED',
  'CANCELLED',
];

const allowed = new Set([
  'PENDING→ACCEPTED',
  'PENDING→CANCELLED',
  'ACCEPTED→PENDING',
  'ACCEPTED→PICKED_UP',
  'ACCEPTED→CANCELLED',
  'PICKED_UP→DELIVERED',
  'PICKED_UP→FAILED',
]);

describe('máquina de estados de la entrega', () => {
  for (const from of statuses) {
    for (const to of statuses) {
      const key = `${from}→${to}`;
      const expected = allowed.has(key);
      it(`${key} ${expected ? 'se permite' : 'se rechaza'}`, () => {
        expect(canTransition(from, to)).toBe(expected);
        if (expected) expect(() => assertTransition(from, to)).not.toThrow();
        else expect(() => assertTransition(from, to)).toThrow(DeliveryInvalidTransitionError);
      });
    }
  }

  it('una entrega en camino NO se puede cancelar', () => {
    expect(() => assertTransition('PICKED_UP', 'CANCELLED')).toThrow(
      expect.objectContaining({
        code: 'DELIVERY_INVALID_TRANSITION',
        statusCode: 409,
        details: { from: 'PICKED_UP', to: 'CANCELLED' },
      }),
    );
  });

  it('clasifica estados activos y finales', () => {
    expect(statuses.filter(isActive)).toEqual(['PENDING', 'ACCEPTED', 'PICKED_UP']);
    expect(statuses.filter(isTerminal)).toEqual(['DELIVERED', 'FAILED', 'CANCELLED']);
  });
});

describe('reglas de dinero', () => {
  it('efectivo: adelanta la comida y cobra comida + envío', () => {
    expect(
      splitDeliveryMoney({ foodTotal: 185.5, deliveryFee: 45, paymentMethod: 'CASH' }),
    ).toEqual({
      foodTotal: 185.5,
      deliveryFee: 45,
      paymentMethod: 'CASH',
      amountCourierAdvances: 185.5,
      amountCourierCollects: 230.5,
    });
  });

  it('transferencia: adelanta 0 y cobra solo el envío', () => {
    expect(
      splitDeliveryMoney({ foodTotal: 185.5, deliveryFee: 45, paymentMethod: 'TRANSFER' }),
    ).toMatchObject({ amountCourierAdvances: 0, amountCourierCollects: 45 });
  });

  it('suma en centavos sin errores de punto flotante', () => {
    expect(
      splitDeliveryMoney({ foodTotal: 0.1, deliveryFee: 0.2, paymentMethod: 'CASH' })
        .amountCourierCollects,
    ).toBe(0.3);
  });
});

describe('tokens y expiraciones', () => {
  it('genera tokens aleatorios de 32 bytes en base64url', () => {
    const token = generateToken();
    expect(Buffer.from(token, 'base64url')).toHaveLength(32);
    expect(isWellFormedToken(token)).toBe(true);
    expect(generateToken()).not.toBe(token);
  });

  it('guarda solo el hash SHA-256 en hex', () => {
    const token = generateToken();
    expect(hashToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(token)).toBe(hashToken(token));
    expect(hashToken(token)).not.toContain(token);
  });

  it('rechaza tokens con forma inválida', () => {
    expect(isWellFormedToken('abc')).toBe(false);
    expect(isWellFormedToken(`${'a'.repeat(42)}!`)).toBe(false);
  });

  it('la oferta dura 60 minutos', () => {
    const now = new Date('2026-11-22T20:00:00.000Z');
    expect(OFFER_TTL_MS).toBe(60 * 60 * 1000);
    expect(offerExpiresAt(now).toISOString()).toBe('2026-11-22T21:00:00.000Z');
  });

  it('el link personal funciona hasta 2 horas después de cerrar la entrega', () => {
    const delivered = new Date('2026-11-22T20:00:00.000Z');
    const closed = closedAt({ deliveredAt: delivered, failedAt: null, cancelledAt: null });
    expect(COURIER_LINK_GRACE_MS).toBe(2 * 60 * 60 * 1000);
    expect(isCourierLinkExpired(closed, new Date('2026-11-22T22:00:00.000Z'))).toBe(false);
    expect(isCourierLinkExpired(closed, new Date('2026-11-22T22:00:00.001Z'))).toBe(true);
    expect(isCourierLinkExpired(null, new Date('2030-01-01T00:00:00.000Z'))).toBe(false);
  });
});

describe('zona aproximada (sin revelar la dirección)', () => {
  const restaurant = { latitude: 23.2494, longitude: -106.4111 };

  it('describe distancia y dirección cardinal desde el restaurante', () => {
    expect(approximateZone(restaurant, { latitude: 23.28, longitude: -106.38 }, 5.6)).toBe(
      '5.6 km al noreste del restaurante',
    );
  });

  it('calcula las direcciones principales', () => {
    expect(cardinalDirection(restaurant, { latitude: 23.3, longitude: -106.4111 })).toBe('norte');
    expect(cardinalDirection(restaurant, { latitude: 23.2, longitude: -106.4111 })).toBe('sur');
    expect(cardinalDirection(restaurant, { latitude: 23.2494, longitude: -106.3 })).toBe('este');
    expect(cardinalDirection(restaurant, { latitude: 23.2494, longitude: -106.5 })).toBe('oeste');
  });

  it('muy cerca o sin ubicación del restaurante omite la dirección', () => {
    expect(approximateZone(restaurant, restaurant, 0.1)).toBe('0.1 km del restaurante');
    expect(approximateZone(null, restaurant, 2)).toBe('2 km del restaurante');
  });

  it('antepone la colonia cuando existe', () => {
    expect(
      approximateZone(restaurant, { latitude: 23.28, longitude: -106.38 }, 5.6, 'Centro'),
    ).toBe('Col. Centro · 5.6 km al noreste del restaurante');
    expect(approximateZone(null, null, 2, 'Centro')).toBe('Col. Centro · 2 km del restaurante');
  });

  it('sin colonia (pedidos previos) muestra solo la distancia', () => {
    expect(approximateZone(null, restaurant, 2, null)).toBe('2 km del restaurante');
    expect(approximateZone(null, restaurant, 2, '   ')).toBe('2 km del restaurante');
  });

  it('normaliza el prefijo de colonia sin recortar nombres que empiezan con "Col"', () => {
    expect(neighborhoodLabel('col. centro')).toBe('Col. Centro');
    expect(neighborhoodLabel('Colonia  Juárez')).toBe('Col. Juárez');
    expect(neighborhoodLabel('Col Benito Juárez')).toBe('Col. Benito Juárez');
    expect(neighborhoodLabel('Colosio')).toBe('Col. Colosio');
    expect(neighborhoodLabel('Colonia')).toBeNull();
    expect(neighborhoodLabel(null)).toBeNull();
  });

  it('nunca incluye coordenadas', () => {
    const zone = approximateZone(restaurant, { latitude: 23.28, longitude: -106.38 }, 5.6);
    expect(zone).not.toMatch(/23\.|106\./);
  });
});
