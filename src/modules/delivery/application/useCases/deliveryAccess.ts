import {
  closedAt,
  hashToken,
  isCourierLinkExpired,
  isWellFormedToken,
} from '../../domain/deliveryTokens.js';
import {
  DeliveryLinkExpiredError,
  DeliveryLinkNotFoundError,
  DeliveryNotFoundError,
  DeliveryOrderNotFoundError,
} from '../../domain/errors/DeliveryErrors.js';
import type {
  CourierLookup,
  DeliveryRecord,
  DeliveryRepository,
  DispatchOrder,
} from '../ports/DeliveryRepository.js';

export type Clock = () => Date;
export const systemClock: Clock = () => new Date();

/** Pedido del dueño con su entrega; 404 si no es suyo o no existe. */
export async function ownerOrder(
  repository: DeliveryRepository,
  ownerUserId: string,
  orderId: string,
): Promise<DispatchOrder> {
  const order = await repository.findOrderForOwner(ownerUserId, orderId);
  if (!order) throw new DeliveryOrderNotFoundError();
  return order;
}

export async function ownerDelivery(
  repository: DeliveryRepository,
  ownerUserId: string,
  orderId: string,
): Promise<{ order: DispatchOrder; delivery: DeliveryRecord }> {
  const order = await ownerOrder(repository, ownerUserId, orderId);
  if (!order.delivery) throw new DeliveryNotFoundError();
  return { order, delivery: order.delivery };
}

/** Resuelve el link personal del repartidor y aplica su expiración (2 h tras cerrar). */
export async function courierDelivery(
  repository: DeliveryRepository,
  courierToken: string,
  now: Date,
): Promise<CourierLookup> {
  if (!isWellFormedToken(courierToken)) throw new DeliveryLinkNotFoundError();
  const lookup = await repository.findByCourierTokenHash(hashToken(courierToken));
  if (!lookup) throw new DeliveryLinkNotFoundError();
  if (isCourierLinkExpired(closedAt(lookup.delivery), now)) throw new DeliveryLinkExpiredError();
  return lookup;
}
