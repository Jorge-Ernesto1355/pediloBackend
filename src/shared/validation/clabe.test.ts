import { describe, expect, it } from 'vitest';
import { detectBank, isValidClabe, normalizeClabe } from './clabe.js';

const banks = ['002', '012', '014', '021', '030', '036', '044', '058', '062', '072', '127', '137', '646', '722'];

function validClabe(bank: string) {
  const base = `${bank}00000000000000`;
  const weights = [3, 7, 1];
  const sum = [...base].reduce((total, digit, index) => total + ((Number(digit) * (weights[index % 3] ?? 0)) % 10), 0);
  return `${base}${(10 - (sum % 10)) % 10}`;
}

describe('CLABE', () => {
  it('valida longitud, símbolos y dígito verificador', () => {
    const value = validClabe('012');
    expect(isValidClabe(value)).toBe(true);
    expect(isValidClabe(value.slice(0, 17))).toBe(false);
    expect(isValidClabe(`${value.slice(0, 17)}9`)).toBe(false);
    expect(normalizeClabe('012-000 000 000 000 001')).toBe(value);
  });

  it.each(banks)('detecta el banco %s', (code) => {
    expect(detectBank(validClabe(code)).code).toBe(code);
  });

  it('usa banco genérico para códigos desconocidos', () => {
    expect(detectBank(validClabe('999'))).toMatchObject({ code: '999', name: 'Banco' });
  });
});
