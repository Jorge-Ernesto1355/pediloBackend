import type { Coordinates } from '../../domain/distance.js';
import type { DeliveryMoney } from '../../domain/deliveryMoney.js';
import type { DeliveryFailureReason, DeliveryStatus } from '../../domain/deliveryStateMachine.js';

export type DeliveryOrderStatus =
  'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface DeliveryRecord extends DeliveryMoney {
  id: string;
  businessId: string;
  orderId: string;
  status: DeliveryStatus;
  offerExpiresAt: Date;
  failureReason: DeliveryFailureReason | null;
  createdAt: Date;
  acceptedAt: Date | null;
  handedOffAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
  /** Solo el repartidor que tomó ESTA entrega. */
  courier: { name: string; phone: string } | null;
}

/** Pedido visto por su dueño, con lo necesario para despachar la entrega. */
export interface DispatchOrder {
  orderId: string;
  businessId: string;
  orderNumber: number;
  status: DeliveryOrderStatus;
  isHomeDelivery: boolean;
  paymentMethod: 'CASH' | 'TRANSFER';
  foodTotal: number;
  deliveryFee: number;
  transferConfirmedAt: Date | null;
  delivery: DeliveryRecord | null;
}

/** Datos para la vista pública de la oferta (solo lo que se muestra sin login). */
export interface OfferLookup {
  delivery: DeliveryRecord;
  restaurantName: string;
  restaurantLocation: Coordinates | null;
  /** Colonia del cliente (sin calle ni número). Null en pedidos previos al campo. */
  neighborhood: string | null;
  destination: Coordinates | null;
  distanceKm: number;
  itemCount: number;
}

export interface CourierItem {
  quantity: number;
  name: string;
  options: string[];
}

/** Detalle completo para el repartidor que tomó la entrega. */
export interface CourierLookup {
  delivery: DeliveryRecord;
  orderNumber: number;
  orderStatus: DeliveryOrderStatus;
  restaurant: { name: string; address: string | null; location: Coordinates | null };
  customer: { name: string | null; phone: string | null };
  address: string;
  neighborhood: string | null;
  reference: string | null;
  destination: Coordinates;
  distanceKm: number;
  notes: string | null;
  items: CourierItem[];
}

export interface NewOffer {
  offerTokenHash: string;
  offerExpiresAt: Date;
  money: DeliveryMoney;
}

/** Resultado de un cambio de estado que también movió el pedido. */
export interface OrderStatusChange {
  orderId: string;
  businessId: string;
  orderNumber: number;
  status: DeliveryOrderStatus;
  updatedAt: Date;
  statusRevision: number;
}

export interface DeliveryRepository {
  findOrderForOwner(ownerUserId: string, orderId: string): Promise<DispatchOrder | null>;
  /** Inserta la entrega PENDING. null si ya existía una para el pedido (carrera). */
  createOffer(order: DispatchOrder, offer: NewOffer): Promise<DeliveryRecord | null>;
  /** PENDING → PENDING con token, expiración y montos nuevos ("compartir de nuevo"). */
  renewOffer(deliveryId: string, offer: NewOffer): Promise<DeliveryRecord | null>;
  findByOfferTokenHash(hash: string): Promise<OfferLookup | null>;
  /**
   * Toma ATÓMICA: UPDATE … WHERE status = 'PENDING' AND courierId IS NULL
   * AND offerExpiresAt > now RETURNING. null si otra persona ganó (o expiró).
   */
  claim(input: {
    offerTokenHash: string;
    courier: { name: string; phone: string };
    courierTokenHash: string;
    now: Date;
  }): Promise<DeliveryRecord | null>;
  findByCourierTokenHash(hash: string): Promise<CourierLookup | null>;
  /** ACCEPTED → PENDING: quita repartidor e invalida su token; nueva oferta. */
  release(deliveryId: string, offer: Omit<NewOffer, 'money'>): Promise<DeliveryRecord | null>;
  /** ACCEPTED → PICKED_UP y pedido → OUT_FOR_DELIVERY, en una transacción. */
  handOff(deliveryId: string, now: Date): Promise<OrderStatusChange | null>;
  /** PICKED_UP → DELIVERED y pedido → DELIVERED, en una transacción. */
  markDelivered(deliveryId: string, now: Date): Promise<OrderStatusChange | null>;
  /** PICKED_UP → FAILED con motivo. El pedido sigue "En camino" (el dueño decide). */
  markFailed(deliveryId: string, reason: DeliveryFailureReason, now: Date): Promise<boolean>;
  /** Marca la transferencia de un pedido como recibida (idempotente). */
  confirmTransfer(ownerUserId: string, orderId: string, now: Date): Promise<Date | null>;
}
