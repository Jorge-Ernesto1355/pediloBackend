import { describe, expect, it } from 'vitest';
import { registerSchema } from './auth.schemas.js';

const validRegistration = {
  name: 'Ana López',
  email: 'ana@example.test',
  password: 'Strong-pass-123',
  acceptLegalDocuments: true,
  ageDeclaration: true,
};

describe('registerSchema legal acceptance', () => {
  it.each([
    ['without legal document acceptance', { ...validRegistration, acceptLegalDocuments: undefined }],
    ['with legal document acceptance false', { ...validRegistration, acceptLegalDocuments: false }],
    ['without age declaration', { ...validRegistration, ageDeclaration: undefined }],
    ['with age declaration false', { ...validRegistration, ageDeclaration: false }],
    ['with an invalid acceptance type', { ...validRegistration, ageDeclaration: 'yes' }],
  ])('rejects %s', (_label, input) => {
    expect(registerSchema.safeParse(input).success).toBe(false);
  });

  it('accepts both explicit true values and rejects unexpected fields', () => {
    expect(registerSchema.safeParse(validRegistration).success).toBe(true);
    expect(registerSchema.safeParse({ ...validRegistration, terms: true }).success).toBe(false);
  });
});
