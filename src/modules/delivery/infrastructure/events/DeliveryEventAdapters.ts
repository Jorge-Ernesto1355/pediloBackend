import { orderEventHub } from '@/modules/orders/infrastructure/sse/OrderEventHub.js';
import type {
  DeliveryEventPublisher,
  OrderStatusNotifier,
} from '../../application/ports/DeliveryEvents.js';

/** Publica en el mismo canal SSE de la comanda. Los fallos de entrega en vivo se ignoran. */
export class SseDeliveryEventPublisher implements DeliveryEventPublisher {
  deliveryChanged(input: { orderId: string; businessId: string; status: string }): void {
    setImmediate(() => {
      try {
        orderEventHub.publishDeliveryUpdated({
          orderId: input.orderId,
          businessId: input.businessId,
          deliveryStatus: input.status,
        });
      } catch {
        // La comanda vuelve a consultar al reconectar; el cambio ya está guardado.
      }
    });
  }

  orderStatusChanged(change: {
    orderId: string;
    businessId: string;
    orderNumber: number;
    status: 'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';
    updatedAt: Date;
    statusRevision: number;
  }): void {
    setImmediate(() => {
      try {
        orderEventHub.publishOrderStatusUpdated(change);
      } catch {
        // Igual que el endpoint de estados: el commit no depende del SSE.
      }
    });
  }
}

/**
 * Punto de integración del aviso "En camino" al cliente. Pedilo no tiene proveedor de
 * WhatsApp en el backend; hoy el dueño envía el aviso con wa.me desde la comanda.
 * Para automatizarlo, implementa OrderStatusNotifier y reemplaza esta clase.
 */
export class NoopOrderStatusNotifier implements OrderStatusNotifier {
  async orderOutForDelivery(): Promise<void> {
    // Intencionalmente vacío.
  }
}
