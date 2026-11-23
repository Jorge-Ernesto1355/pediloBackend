import { describe, expect, it, vi } from 'vitest';
import type { DeliverySettings } from '../../domain/deliverySettings.js';
import {
  DeliveryBusinessNotFoundError,
  DeliveryNotConfiguredError,
  DeliverySettingsInvalidError,
} from '../../domain/errors/DeliveryErrors.js';
import type {
  DeliverySettingsRepository,
  SaveDeliverySettingsInput,
} from '../ports/DeliverySettingsRepository.js';
import { GetDeliverySettings } from './GetDeliverySettings.js';
import { QuoteDelivery } from './QuoteDelivery.js';
import { UpdateDeliverySettings } from './UpdateDeliverySettings.js';

const origin = { latitude: 23.2494, longitude: -106.4111 };
const feeConfig = { type: 'DISTANCE_TIERS' as const, tiers: [{ upToKm: 5, fee: 40 }] };

function fakeRepository(initial: DeliverySettings | null, businessId: string | null = 'biz-1') {
  let stored = initial;
  const repository: DeliverySettingsRepository = {
    findBusinessIdByUserId: vi.fn(async () => businessId),
    getByBusinessId: vi.fn(async () => stored),
    save: vi.fn(async (_id: string, input: SaveDeliverySettingsInput) => {
      stored = {
        enabled: input.enabled,
        maxDeliveryKm: input.maxDeliveryKm,
        feeConfig: input.feeConfig,
        origin: input.origin ?? stored?.origin ?? null,
      };
      return stored;
    }),
  };
  return repository;
}

const disabled: DeliverySettings = {
  enabled: false,
  origin: null,
  maxDeliveryKm: null,
  feeConfig: null,
};

describe('GetDeliverySettings', () => {
  it('devuelve la configuración del negocio del usuario', async () => {
    const repository = fakeRepository({ ...disabled, origin });
    await expect(new GetDeliverySettings(repository).execute('user-1')).resolves.toEqual({
      ...disabled,
      origin,
    });
  });

  it('falla si el usuario no tiene negocio', async () => {
    const repository = fakeRepository(disabled, null);
    await expect(new GetDeliverySettings(repository).execute('user-1')).rejects.toThrow(
      DeliveryBusinessNotFoundError,
    );
  });
});

describe('UpdateDeliverySettings', () => {
  it('activa usando la ubicación ya guardada del negocio', async () => {
    const repository = fakeRepository({ ...disabled, origin });
    const result = await new UpdateDeliverySettings(repository).execute('user-1', {
      enabled: true,
      maxDeliveryKm: 5,
      feeConfig,
    });
    expect(result).toEqual({ enabled: true, origin, maxDeliveryKm: 5, feeConfig });
    expect(repository.save).toHaveBeenCalledWith('biz-1', {
      enabled: true,
      maxDeliveryKm: 5,
      feeConfig,
    });
  });

  it('activa con una ubicación nueva enviada en la misma petición', async () => {
    const repository = fakeRepository(disabled);
    const result = await new UpdateDeliverySettings(repository).execute('user-1', {
      enabled: true,
      maxDeliveryKm: 5,
      feeConfig,
      origin,
    });
    expect(result.origin).toEqual(origin);
  });

  it('no guarda si falta la ubicación al activar', async () => {
    const repository = fakeRepository(disabled);
    const attempt = new UpdateDeliverySettings(repository).execute('user-1', {
      enabled: true,
      maxDeliveryKm: 5,
      feeConfig,
    });
    await expect(attempt).rejects.toThrow(DeliverySettingsInvalidError);
    await attempt.catch((error: DeliverySettingsInvalidError) =>
      expect(error.details.issues).toContain('ORIGIN_MISSING'),
    );
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('no guarda si los tramos no cubren el radio', async () => {
    const repository = fakeRepository({ ...disabled, origin });
    await expect(
      new UpdateDeliverySettings(repository).execute('user-1', {
        enabled: true,
        maxDeliveryKm: 8,
        feeConfig,
      }),
    ).rejects.toThrow(DeliverySettingsInvalidError);
    expect(repository.save).not.toHaveBeenCalled();
  });

  it('permite desactivar sin tarifa ni radio', async () => {
    const repository = fakeRepository({ enabled: true, origin, maxDeliveryKm: 5, feeConfig });
    const result = await new UpdateDeliverySettings(repository).execute('user-1', {
      enabled: false,
      maxDeliveryKm: null,
      feeConfig: null,
    });
    expect(result.enabled).toBe(false);
  });
});

describe('QuoteDelivery', () => {
  it('cotiza con la configuración guardada', async () => {
    const repository = fakeRepository({ enabled: true, origin, maxDeliveryKm: 5, feeConfig });
    await expect(new QuoteDelivery(repository).execute('biz-1', origin)).resolves.toEqual({
      distanceKm: 0,
      fee: 40,
      maxDeliveryKm: 5,
    });
  });

  it('falla si el negocio no existe', async () => {
    const repository = fakeRepository(null);
    await expect(new QuoteDelivery(repository).execute('missing', origin)).rejects.toThrow(
      DeliveryBusinessNotFoundError,
    );
  });

  it('falla si el restaurante no tiene ubicación', async () => {
    const repository = fakeRepository({ enabled: true, origin: null, maxDeliveryKm: 5, feeConfig });
    await expect(new QuoteDelivery(repository).execute('biz-1', origin)).rejects.toThrow(
      DeliveryNotConfiguredError,
    );
  });
});
