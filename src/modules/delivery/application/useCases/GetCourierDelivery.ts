import { isActive } from '../../domain/deliveryStateMachine.js';
import type { DeliveryFailureReason, DeliveryStatus } from '../../domain/deliveryStateMachine.js';
import type { Coordinates } from '../../domain/distance.js';
import type { CourierItem, DeliveryRepository } from '../ports/DeliveryRepository.js';
import { type Clock, courierDelivery, systemClock } from './deliveryAccess.js';

/** Detalle completo para quien tomó la entrega (/entrega/:token). */
export interface CourierDeliveryView {
  status: DeliveryStatus;
  isActive: boolean;
  orderNumber: number;
  restaurant: { name: string; address: string | null; location: Coordinates | null };
  /** El teléfono solo mientras la entrega está activa. */
  customer: { name: string | null; phone: string | null };
  address: string;
  neighborhood: string | null;
  reference: string | null;
  destination: Coordinates;
  distanceKm: number;
  notes: string | null;
  items: CourierItem[];
  money: {
    paymentMethod: 'CASH' | 'TRANSFER';
    foodTotal: number;
    /** Pagas al restaurante. */
    amountCourierAdvances: number;
    /** Cobras al cliente. */
    amountCourierCollects: number;
    /** Tu ganancia (el envío completo). */
    courierEarnings: number;
  };
  failureReason: DeliveryFailureReason | null;
  acceptedAt: Date | null;
  handedOffAt: Date | null;
  deliveredAt: Date | null;
  failedAt: Date | null;
  cancelledAt: Date | null;
}

export class GetCourierDelivery {
  constructor(
    private readonly repository: DeliveryRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(courierToken: string): Promise<CourierDeliveryView> {
    const lookup = await courierDelivery(this.repository, courierToken, this.clock());
    const { delivery } = lookup;
    const active = isActive(delivery.status);
    return {
      status: delivery.status,
      isActive: active,
      orderNumber: lookup.orderNumber,
      restaurant: lookup.restaurant,
      customer: { name: lookup.customer.name, phone: active ? lookup.customer.phone : null },
      address: lookup.address,
      neighborhood: lookup.neighborhood,
      reference: lookup.reference,
      destination: lookup.destination,
      distanceKm: lookup.distanceKm,
      notes: lookup.notes,
      items: lookup.items,
      money: {
        paymentMethod: delivery.paymentMethod,
        foodTotal: delivery.foodTotal,
        amountCourierAdvances: delivery.amountCourierAdvances,
        amountCourierCollects: delivery.amountCourierCollects,
        courierEarnings: delivery.deliveryFee,
      },
      failureReason: delivery.failureReason,
      acceptedAt: delivery.acceptedAt,
      handedOffAt: delivery.handedOffAt,
      deliveredAt: delivery.deliveredAt,
      failedAt: delivery.failedAt,
      cancelledAt: delivery.cancelledAt,
    };
  }
}
