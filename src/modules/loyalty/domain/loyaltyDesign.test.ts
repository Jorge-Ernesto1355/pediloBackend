import { describe, expect, it } from 'vitest';
import { defaultLoyaltyDesign, loyaltyDesignSchema, readStoredDesign } from './loyaltyDesign.js';
import { defaultLoyaltyProgram, defaultRewardLabel } from './loyaltyProgram.js';
import {
  cardTokenFingerprint,
  generateCardToken,
  isWellFormedCardToken,
  sameCardToken,
} from './loyaltyTokens.js';

describe('diseño de la tarjeta (lista cerrada)', () => {
  it('el diseño por defecto es válido y usa el nombre del restaurante como título', () => {
    const design = defaultLoyaltyDesign('Taquería Los Primos del Puerto de Mazatlán');
    expect(loyaltyDesignSchema.safeParse(design).success).toBe(true);
    expect(design.text.title.length).toBeLessThanOrEqual(30);
    expect(design.text.title.startsWith('Taquería Los Primos')).toBe(true);
  });

  it('rechaza colores que no son #RRGGBB', () => {
    for (const color of ['#FFF', 'red', '#12345G', 'rgb(0,0,0)', '#1234567']) {
      const design = defaultLoyaltyDesign('X');
      design.stamp.filledColor = color;
      expect(loyaltyDesignSchema.safeParse(design).success, color).toBe(false);
    }
  });

  it('normaliza los colores a mayúsculas', () => {
    const design = defaultLoyaltyDesign('X');
    design.text.primaryColor = '#a1b2c3';
    const parsed = loyaltyDesignSchema.parse(design);
    expect(parsed.text.primaryColor).toBe('#A1B2C3');
  });

  it('rechaza valores fuera de la lista cerrada y campos desconocidos (sin CSS libre)', () => {
    const badShape = {
      ...defaultLoyaltyDesign('X'),
      stamp: { ...defaultLoyaltyDesign('X').stamp, shape: 'triangle' },
    };
    expect(loyaltyDesignSchema.safeParse(badShape).success).toBe(false);
    const extra = { ...defaultLoyaltyDesign('X'), css: 'background: url(x)' };
    expect(loyaltyDesignSchema.safeParse(extra).success).toBe(false);
    const columns = { ...defaultLoyaltyDesign('X'), layout: { columns: 7, rewardSlot: 'icon' } };
    expect(loyaltyDesignSchema.safeParse(columns).success).toBe(false);
  });

  it('limita el título a 30 y el subtítulo a 40 caracteres', () => {
    const design = defaultLoyaltyDesign('X');
    design.text.title = 'a'.repeat(31);
    expect(loyaltyDesignSchema.safeParse(design).success).toBe(false);
    design.text.title = 'ok';
    design.text.subtitle = 'b'.repeat(41);
    expect(loyaltyDesignSchema.safeParse(design).success).toBe(false);
  });

  it('limpia caracteres de control de los textos', () => {
    const design = defaultLoyaltyDesign('X');
    design.text.title = 'Hola\u0000\nmundo';
    expect(loyaltyDesignSchema.parse(design).text.title).toBe('Hola mundo');
  });

  it('un diseño guardado inválido se lee como el diseño por defecto', () => {
    expect(readStoredDesign({ template: 'nope' }, 'Mi café').text.title).toBe('Mi café');
  });
});

describe('programa por defecto', () => {
  it('8 sellos, manual, 20% de descuento y sin caducidad', () => {
    const program = defaultLoyaltyProgram('Mi café');
    expect(program).toMatchObject({
      stampsRequired: 8,
      stampMode: 'MANUAL',
      rewardType: 'PERCENT',
      rewardValue: 20,
      rewardExpiresDays: null,
      rewardLabel: '20% de descuento',
      walkInDailyLimit: 5,
    });
  });

  it('genera el nombre visible del premio', () => {
    expect(defaultRewardLabel('FIXED', 50, null)).toBe('$50 de descuento');
    expect(defaultRewardLabel('FREE_PRODUCT', 0, 'Café americano')).toBe('Café americano gratis');
  });
});

describe('llave de la tarjeta', () => {
  it('tiene 32 bytes aleatorios en base64url (43 caracteres) y no se repite', () => {
    const tokens = new Set(Array.from({ length: 200 }, generateCardToken));
    expect(tokens.size).toBe(200);
    for (const token of tokens) expect(isWellFormedCardToken(token)).toBe(true);
  });

  it('rechaza formas inválidas', () => {
    expect(isWellFormedCardToken('corto')).toBe(false);
    expect(isWellFormedCardToken(`${'a'.repeat(42)}=`)).toBe(false);
  });

  it('compara en tiempo constante y la huella no revela el token', () => {
    const token = generateCardToken();
    expect(sameCardToken(token, token)).toBe(true);
    expect(sameCardToken(token, generateCardToken())).toBe(false);
    expect(cardTokenFingerprint(token)).not.toContain(token.slice(0, 8));
  });
});
