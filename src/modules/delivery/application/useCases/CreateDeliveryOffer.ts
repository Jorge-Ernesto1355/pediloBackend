import { splitDeliveryMoney } from '../../domain/deliveryMoney.js';
import { generateToken, hashToken, offerExpiresAt } from '../../domain/deliveryTokens.js';
import { isTerminal } from '../../domain/deliveryStateMachine.js';
import {
  DeliveryAlreadyAcceptedError,
  DeliveryClosedError,
  DeliveryNotHomeDeliveryOrderError,
  DeliveryOrderNotReadyError,
  DeliveryTransferNotConfirmedError,
} from '../../domain/errors/DeliveryErrors.js';
import type { DeliveryEventPublisher } from '../ports/DeliveryEvents.js';
import type { DeliveryRecord, DeliveryRepository, NewOffer } from '../ports/DeliveryRepository.js';
import { type Clock, ownerOrder, systemClock } from './deliveryAccess.js';

export interface DeliveryOfferResult {
  delivery: DeliveryRecord;
  /** Token en claro para el link público /e/:token. Solo se devuelve aquí. */
  offerToken: string;
}

/**
 * "Buscar repartidor". Si ya hay una oferta pendiente, la renueva ("compartir de nuevo"):
 * token nuevo (el link anterior deja de funcionar), 60 minutos más y montos actualizados.
 */
export class CreateDeliveryOffer {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly events: DeliveryEventPublisher,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(ownerUserId: string, orderId: string): Promise<DeliveryOfferResult> {
    const order = await ownerOrder(this.repository, ownerUserId, orderId);
    if (!order.isHomeDelivery) throw new DeliveryNotHomeDeliveryOrderError();
    if (order.status !== 'PREPARING' && order.status !== 'READY') {
      throw new DeliveryOrderNotReadyError(order.status);
    }
    if (order.paymentMethod === 'TRANSFER' && !order.transferConfirmedAt) {
      throw new DeliveryTransferNotConfirmedError();
    }

    const existing = order.delivery;
    if (existing && existing.status !== 'PENDING') {
      if (isTerminal(existing.status)) throw new DeliveryClosedError(existing.status);
      throw new DeliveryAlreadyAcceptedError();
    }

    const offerToken = generateToken();
    const offer: NewOffer = {
      offerTokenHash: hashToken(offerToken),
      offerExpiresAt: offerExpiresAt(this.clock()),
      money: splitDeliveryMoney({
        foodTotal: order.foodTotal,
        deliveryFee: order.deliveryFee,
        paymentMethod: order.paymentMethod,
      }),
    };

    const delivery = existing
      ? await this.repository.renewOffer(existing.id, offer)
      : await this.repository.createOffer(order, offer);
    // null: otra petición cambió la entrega a la vez (p. ej. doble clic o ya la tomaron).
    if (!delivery) throw new DeliveryAlreadyAcceptedError();

    this.events.deliveryChanged({
      orderId: order.orderId,
      businessId: order.businessId,
      status: delivery.status,
    });
    return { delivery, offerToken };
  }
}
