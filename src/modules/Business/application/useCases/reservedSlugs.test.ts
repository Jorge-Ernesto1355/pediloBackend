import { describe, expect, it, vi } from 'vitest';
import { BusinessAlreadyExistsError } from '../../domain/errors/BusinessErrors.js';
import type { BusinessRepository } from '../../domain/ports/BusinessRepository.js';
import { isReservedBusinessSlug } from '../../domain/reservedSlugs.js';
import type { ImageStorage } from '../ports/ImageStorage.js';
import { CreateBusiness } from './CreateBusiness.js';
import { UpdateBusiness } from './UpdateBusiness.js';

function repository(overrides: Partial<Record<keyof BusinessRepository, unknown>> = {}) {
  return {
    getByUserId: vi.fn().mockResolvedValue(null),
    getBySlug: vi.fn().mockResolvedValue(null),
    create: vi.fn(),
    update: vi.fn(),
    getImages: vi.fn().mockResolvedValue([]),
    ...overrides,
  } as unknown as BusinessRepository;
}

const storage = {} as ImageStorage;

describe('slugs reservados para las rutas del repartidor', () => {
  it('reserva "e" y "entrega" sin importar mayúsculas ni espacios', () => {
    expect(isReservedBusinessSlug('e')).toBe(true);
    expect(isReservedBusinessSlug('entrega')).toBe(true);
    expect(isReservedBusinessSlug(' Entrega ')).toBe(true);
  });

  it('no reserva slugs parecidos', () => {
    expect(isReservedBusinessSlug('entregas-rapidas')).toBe(false);
    expect(isReservedBusinessSlug('tacos-e')).toBe(false);
  });

  it('reserva "tarjeta" para el link de la tarjeta de lealtad', () => {
    expect(isReservedBusinessSlug('tarjeta')).toBe(true);
    expect(isReservedBusinessSlug(' Tarjeta ')).toBe(true);
    expect(isReservedBusinessSlug('tarjetas-y-mas')).toBe(false);
  });

  it('crear un negocio con slug "entrega" responde como slug ocupado', async () => {
    const repo = repository();
    await expect(
      new CreateBusiness(repo, storage).execute('user-1', {
        name: 'Entrega rápida',
        slug: 'entrega',
      } as never),
    ).rejects.toBeInstanceOf(BusinessAlreadyExistsError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('un nombre que se convierte en "entrega" también se rechaza', async () => {
    const repo = repository();
    await expect(
      new CreateBusiness(repo, storage).execute('user-1', { name: 'Entrega' } as never),
    ).rejects.toBeInstanceOf(BusinessAlreadyExistsError);
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('cambiar el slug a "entrega" se rechaza sin guardar', async () => {
    const repo = repository({
      getByUserId: vi.fn().mockResolvedValue({ id: 'biz-1', slug: 'tacos-don-pepe' }),
    });
    await expect(
      new UpdateBusiness(repo, storage).execute('user-1', 'biz-1', { slug: 'entrega' } as never),
    ).rejects.toBeInstanceOf(BusinessAlreadyExistsError);
    expect(repo.update).not.toHaveBeenCalled();
  });
});
