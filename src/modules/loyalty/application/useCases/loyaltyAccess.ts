import { LoyaltyBusinessNotFoundError } from '../../domain/errors/LoyaltyErrors.js';
import type { LoyaltyRepository, OwnerBusiness } from '../ports/LoyaltyRepository.js';

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

/**
 * Negocio del dueño autenticado. El id del restaurante SIEMPRE sale de la sesión;
 * nunca se confía en un id que mande el navegador.
 */
export async function ownerBusiness(
  repository: LoyaltyRepository,
  ownerUserId: string,
): Promise<OwnerBusiness> {
  const business = await repository.findOwnerBusiness(ownerUserId);
  if (!business) throw new LoyaltyBusinessNotFoundError();
  return business;
}
