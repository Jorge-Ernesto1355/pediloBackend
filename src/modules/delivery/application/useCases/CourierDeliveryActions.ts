import { assertTransition, type DeliveryFailureReason } from '../../domain/deliveryStateMachine.js';
import { DeliveryInvalidTransitionError } from '../../domain/errors/DeliveryErrors.js';
import type { DeliveryEventPublisher } from '../ports/DeliveryEvents.js';
import type { DeliveryRepository } from '../ports/DeliveryRepository.js';
import { type Clock, courierDelivery, systemClock } from './deliveryAccess.js';

/** "Entregado" (repartidor): picked_up → delivered y el pedido se cierra como entregado. */
export class CompleteDelivery {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly events: DeliveryEventPublisher,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(courierToken: string): Promise<void> {
    const now = this.clock();
    const { delivery } = await courierDelivery(this.repository, courierToken, now);
    assertTransition(delivery.status, 'DELIVERED');
    const change = await this.repository.markDelivered(delivery.id, now);
    if (!change) throw new DeliveryInvalidTransitionError(delivery.status, 'DELIVERED');
    this.events.deliveryChanged({
      orderId: delivery.orderId,
      businessId: delivery.businessId,
      status: 'DELIVERED',
    });
    this.events.orderStatusChanged(change);
  }
}

/** "No se pudo entregar" (repartidor): picked_up → failed con motivo. */
export class FailDelivery {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly events: DeliveryEventPublisher,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(courierToken: string, reason: DeliveryFailureReason): Promise<void> {
    const now = this.clock();
    const { delivery } = await courierDelivery(this.repository, courierToken, now);
    assertTransition(delivery.status, 'FAILED');
    const failed = await this.repository.markFailed(delivery.id, reason, now);
    if (!failed) throw new DeliveryInvalidTransitionError(delivery.status, 'FAILED');
    this.events.deliveryChanged({
      orderId: delivery.orderId,
      businessId: delivery.businessId,
      status: 'FAILED',
    });
  }
}
