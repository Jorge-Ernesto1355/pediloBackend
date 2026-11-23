import { OrderCancelledError, OrderNotTransferError } from '../../domain/errors/DeliveryErrors.js';
import type { DeliveryRepository } from '../ports/DeliveryRepository.js';
import { type Clock, ownerOrder, systemClock } from './deliveryAccess.js';

/** "Marcar transferencia recibida". Requisito para buscar repartidor en pedidos por transferencia. */
export class ConfirmOrderTransfer {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(ownerUserId: string, orderId: string): Promise<{ transferConfirmedAt: Date }> {
    const order = await ownerOrder(this.repository, ownerUserId, orderId);
    if (order.paymentMethod !== 'TRANSFER') throw new OrderNotTransferError();
    if (order.transferConfirmedAt) return { transferConfirmedAt: order.transferConfirmedAt };
    if (order.status === 'CANCELLED') throw new OrderCancelledError();
    const confirmedAt = await this.repository.confirmTransfer(ownerUserId, orderId, this.clock());
    if (!confirmedAt) throw new OrderNotTransferError();
    return { transferConfirmedAt: confirmedAt };
  }
}
