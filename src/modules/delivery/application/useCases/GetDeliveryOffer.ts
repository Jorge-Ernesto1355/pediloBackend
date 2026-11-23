import { approximateZone } from '../../domain/approximateZone.js';
import { hashToken, isWellFormedToken } from '../../domain/deliveryTokens.js';
import { DeliveryLinkNotFoundError } from '../../domain/errors/DeliveryErrors.js';
import type { DeliveryRepository } from '../ports/DeliveryRepository.js';
import { type Clock, systemClock } from './deliveryAccess.js';

/**
 * Vista pública de la oferta (/e/:token). Antes de tomarla el repartidor ve SOLO:
 * restaurante, zona aproximada (colonia + distancia), ganancia, cuánto adelanta y cuántos
 * artículos. NUNCA calle, número, coordenadas, nombre ni teléfono del cliente.
 */
export type DeliveryOfferView =
  | {
      state: 'AVAILABLE';
      restaurantName: string;
      zone: string;
      courierEarnings: number;
      amountToAdvance: number;
      itemCount: number;
    }
  | { state: 'TAKEN' | 'EXPIRED'; restaurantName: string };

export class GetDeliveryOffer {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(offerToken: string): Promise<DeliveryOfferView> {
    if (!isWellFormedToken(offerToken)) throw new DeliveryLinkNotFoundError();
    const lookup = await this.repository.findByOfferTokenHash(hashToken(offerToken));
    if (!lookup) throw new DeliveryLinkNotFoundError();

    const { delivery, restaurantName } = lookup;
    if (delivery.status === 'CANCELLED') return { state: 'EXPIRED', restaurantName };
    if (delivery.status !== 'PENDING') return { state: 'TAKEN', restaurantName };
    if (delivery.offerExpiresAt.getTime() <= this.clock().getTime()) {
      return { state: 'EXPIRED', restaurantName };
    }
    return {
      state: 'AVAILABLE',
      restaurantName,
      zone: approximateZone(
        lookup.restaurantLocation,
        lookup.destination,
        lookup.distanceKm,
        lookup.neighborhood,
      ),
      courierEarnings: delivery.deliveryFee,
      amountToAdvance: delivery.amountCourierAdvances,
      itemCount: lookup.itemCount,
    };
  }
}
