import { assertTransition } from '../../domain/deliveryStateMachine.js';
import { generateToken, hashToken, offerExpiresAt } from '../../domain/deliveryTokens.js';
import { DeliveryInvalidTransitionError } from '../../domain/errors/DeliveryErrors.js';
import type { DeliveryEventPublisher } from '../ports/DeliveryEvents.js';
import type { DeliveryRepository } from '../ports/DeliveryRepository.js';
import type { DeliveryOfferResult } from './CreateDeliveryOffer.js';
import { type Clock, ownerDelivery, systemClock } from './deliveryAccess.js';

/**
 * El dueño libera la entrega (accepted → pending): el repartidor pierde el acceso
 * (su token se invalida) y se genera una oferta nueva para compartir.
 */
export class ReleaseDelivery {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly events: DeliveryEventPublisher,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(ownerUserId: string, orderId: string): Promise<DeliveryOfferResult> {
    const { order, delivery } = await ownerDelivery(this.repository, ownerUserId, orderId);
    assertTransition(delivery.status, 'PENDING');

    const offerToken = generateToken();
    const released = await this.repository.release(delivery.id, {
      offerTokenHash: hashToken(offerToken),
      offerExpiresAt: offerExpiresAt(this.clock()),
    });
    if (!released) throw new DeliveryInvalidTransitionError(delivery.status, 'PENDING');

    this.events.deliveryChanged({
      orderId: order.orderId,
      businessId: order.businessId,
      status: released.status,
    });
    return { delivery: released, offerToken };
  }
}
