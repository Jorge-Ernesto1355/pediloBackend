import { generateToken, hashToken, isWellFormedToken } from '../../domain/deliveryTokens.js';
import {
  DeliveryAlreadyTakenError,
  DeliveryLinkExpiredError,
  DeliveryLinkNotFoundError,
} from '../../domain/errors/DeliveryErrors.js';
import type { DeliveryEventPublisher } from '../ports/DeliveryEvents.js';
import type { DeliveryRepository } from '../ports/DeliveryRepository.js';
import { type Clock, systemClock } from './deliveryAccess.js';

/**
 * "Tomar". La primera persona gana (actualización atómica en la base); las demás reciben
 * DELIVERY_ALREADY_TAKEN. Devuelve el token del link personal /entrega/:token.
 * El repartidor se busca o crea por teléfono (global: sirve a varios restaurantes).
 */
export class ClaimDelivery {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly events: DeliveryEventPublisher,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(
    offerToken: string,
    courier: { name: string; phone: string },
  ): Promise<{ courierToken: string }> {
    if (!isWellFormedToken(offerToken)) throw new DeliveryLinkNotFoundError();
    const offerTokenHash = hashToken(offerToken);
    const courierToken = generateToken();
    const now = this.clock();

    const claimed = await this.repository.claim({
      offerTokenHash,
      courier,
      courierTokenHash: hashToken(courierToken),
      now,
    });

    if (!claimed) {
      const lookup = await this.repository.findByOfferTokenHash(offerTokenHash);
      if (!lookup) throw new DeliveryLinkNotFoundError();
      if (lookup.delivery.status === 'CANCELLED') throw new DeliveryLinkExpiredError();
      if (lookup.delivery.status === 'PENDING') throw new DeliveryLinkExpiredError();
      throw new DeliveryAlreadyTakenError();
    }

    this.events.deliveryChanged({
      orderId: claimed.orderId,
      businessId: claimed.businessId,
      status: claimed.status,
    });
    return { courierToken };
  }
}
