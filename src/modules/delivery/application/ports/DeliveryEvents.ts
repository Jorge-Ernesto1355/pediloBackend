import type { DeliveryStatus } from '../../domain/deliveryStateMachine.js';
import type { OrderStatusChange } from './DeliveryRepository.js';

/** Avisos en vivo para la comanda (SSE). Fallar aquí nunca revierte un cambio guardado. */
export interface DeliveryEventPublisher {
  deliveryChanged(input: { orderId: string; businessId: string; status: DeliveryStatus }): void;
  orderStatusChanged(change: OrderStatusChange): void;
}

/**
 * Punto de integración para avisar al cliente que su pedido va en camino.
 * Pedilo no tiene un proveedor de WhatsApp en el backend: hoy el dueño envía el aviso
 * con un enlace wa.me desde la comanda. Un proveedor futuro solo implementa este puerto.
 */
export interface OrderStatusNotifier {
  orderOutForDelivery(input: {
    orderId: string;
    businessId: string;
    orderNumber: number;
  }): Promise<void>;
}
