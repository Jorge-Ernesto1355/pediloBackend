import { describe, expect, it } from 'vitest';
import { redactUrlTokens } from './redact-url-tokens.js';

const token = 'Ab3_-xY9Ab3_-xY9Ab3_-xY9Ab3_-xY9Ab3_-xY9abc';

describe('redactUrlTokens', () => {
  it('quita la llave de los links privados de la URL', () => {
    expect(redactUrlTokens(`/api/v1/public/loyalty/${token}`)).toBe(
      '/api/v1/public/loyalty/:token',
    );
    expect(redactUrlTokens(`/api/v1/public/deliveries/offer/${token}/claim?x=1`)).toBe(
      '/api/v1/public/deliveries/offer/:token/claim?x=1',
    );
  });

  it('quita llaves en parámetros de consulta', () => {
    expect(redactUrlTokens(`/tarjeta?t=${token}`)).toBe('/tarjeta?t=:token');
  });

  it('no toca ids normales ni slugs', () => {
    const url = '/api/v1/businesses/orders/cmhx1abcd0000qz8f2k3l4m5n/stamp';
    expect(redactUrlTokens(url)).toBe(url);
    expect(redactUrlTokens('/api/v1/public/businesses/mi-taqueria/loyalty')).toBe(
      '/api/v1/public/businesses/mi-taqueria/loyalty',
    );
  });
});
