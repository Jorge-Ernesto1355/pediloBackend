import { describe, expect, it } from 'vitest';
import {
  createBusinessSettingsSchema,
  updateBusinessSettingsSchema,
} from './business-settings.schemas.js';

describe('business settings schemas', () => {
  it('applies defaults when creating settings', () => {
    expect(createBusinessSettingsSchema.parse({})).toEqual({
      currency: 'MXN',
      phone: null,
      whatsapp: null,
      address: null,
      timezone: 'America/Mazatlan',
    });
  });

  it('accepts nullable contact fields and valid IANA timezones', () => {
    expect(
      createBusinessSettingsSchema.parse({
        phone: null,
        whatsapp: '668 123 4567',
        address: null,
        timezone: 'UTC',
      }),
    ).toMatchObject({ phone: null, whatsapp: '6681234567', timezone: 'UTC' });
  });

  it('rejects unknown fields, unsupported currencies, invalid phones, and invalid timezones', () => {
    expect(createBusinessSettingsSchema.safeParse({ businessId: 'other-business' }).success).toBe(
      false,
    );
    expect(createBusinessSettingsSchema.safeParse({ currency: 'EUR' }).success).toBe(false);
    expect(createBusinessSettingsSchema.safeParse({ phone: '668123456' }).success).toBe(false);
    expect(createBusinessSettingsSchema.safeParse({ phone: 6681234567 }).success).toBe(false);
    expect(updateBusinessSettingsSchema.safeParse({ timezone: 'Not/AZone' }).success).toBe(false);
  });

  it('requires at least one field on partial updates', () => {
    expect(updateBusinessSettingsSchema.safeParse({}).success).toBe(false);
  });
});
