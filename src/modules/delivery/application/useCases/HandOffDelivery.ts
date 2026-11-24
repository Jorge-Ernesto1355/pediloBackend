import { assertTransition } from '../../domain/deliveryStateMachine.js';
import { DeliveryInvalidTransitionError } from '../../domain/errors/DeliveryErrors.js';
import type { DeliveryEventPublisher, OrderStatusNotifier } from '../ports/DeliveryEvents.js';
import type { DeliveryRepository, OrderStatusChange } from '../ports/DeliveryRepository.js';
import { type Clock, ownerDelivery, systemClock } from './deliveryAccess.js';

/**
 * "Entregado al repartidor (recibí $X)": accepted → picked_up y el pedido pasa a "En camino".
 */
export class HandOffDelivery {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly events: DeliveryEventPublisher,
    private readonly notifier: OrderStatusNotifier,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(ownerUserId: string, orderId: string): Promise<OrderStatusChange> {
    const { order, delivery } = await ownerDelivery(this.repository, ownerUserId, orderId);
    assertTransition(delivery.status, 'PICKED_UP');

    const change = await this.repository.handOff(delivery.id, this.clock());
    if (!change) throw new DeliveryInvalidTransitionError(delivery.status, 'PICKED_UP');

    this.events.deliveryChanged({
      orderId: order.orderId,
      businessId: order.businessId,
      status: 'PICKED_UP',
    });
    this.events.orderStatusChanged(change);
    // El aviso al cliente nunca revierte la entrega ya guardada.
    await this.notifier
      .orderOutForDelivery({
        orderId: change.orderId,
        businessId: change.businessId,
        orderNumber: change.orderNumber,
      })
      .catch(() => undefined);
    return change;
  }
}
