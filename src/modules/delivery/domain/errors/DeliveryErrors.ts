import { AppError } from '@/shared/errors/app-error.js';
import type { FeeConfigIssue } from '../feePolicy.js';

export class DeliveryBusinessNotFoundError extends AppError {
  constructor() {
    super('Business not found', 404, 'BUSINESS_NOT_FOUND');
  }
}

export type DeliverySettingsIssue =
  | FeeConfigIssue
  | 'ORIGIN_MISSING'
  | 'MAX_KM_MISSING'
  | 'MAX_KM_INVALID'
  | 'TIERS_DO_NOT_COVER_MAX_KM';

export class DeliverySettingsInvalidError extends AppError {
  readonly details: { issues: DeliverySettingsIssue[] };

  constructor(issues: DeliverySettingsIssue[]) {
    super('Delivery settings are invalid', 400, 'DELIVERY_SETTINGS_INVALID');
    this.details = { issues };
  }
}

/** El restaurante no tiene envío a domicilio activo. */
export class DeliveryUnavailableError extends AppError {
  constructor() {
    super('Home delivery is not available for this restaurant', 409, 'DELIVERY_UNAVAILABLE');
  }
}

/** Envío activo pero incompleto (sin ubicación del restaurante, radio o tarifa). */
export class DeliveryNotConfiguredError extends AppError {
  constructor() {
    super('Home delivery is not configured for this restaurant', 409, 'DELIVERY_NOT_CONFIGURED');
  }
}

export class DeliveryOutOfRangeError extends AppError {
  readonly details: { distanceKm: number; maxDeliveryKm: number };

  constructor(distanceKm: number, maxDeliveryKm: number) {
    super('The address is outside the delivery area', 422, 'DELIVERY_OUT_OF_RANGE');
    this.details = { distanceKm, maxDeliveryKm };
  }
}

/**
 * El envío recalculado en el servidor no coincide con el que vio el cliente.
 * Misma regla que ORDER_PRICE_CHANGED: el pedido NO se crea y el cliente confirma el nuevo total.
 */
export class DeliveryFeeChangedError extends AppError {
  readonly details: { expectedDeliveryFee: number; currentDeliveryFee: number; distanceKm: number };

  constructor(expectedDeliveryFee: number, currentDeliveryFee: number, distanceKm: number) {
    super('The delivery fee changed while checking out', 409, 'DELIVERY_FEE_CHANGED');
    this.details = { expectedDeliveryFee, currentDeliveryFee, distanceKm };
  }
}

export class DeliveryInvalidTransitionError extends AppError {
  readonly details: { from: string; to: string };

  constructor(from: string, to: string) {
    super(`Delivery cannot change from ${from} to ${to}`, 409, 'DELIVERY_INVALID_TRANSITION');
    this.details = { from, to };
  }
}

export class DeliveryOrderNotFoundError extends AppError {
  constructor() {
    super('Order not found', 404, 'ORDER_NOT_FOUND');
  }
}

export class DeliveryNotHomeDeliveryOrderError extends AppError {
  constructor() {
    super('The order is not a home delivery order', 409, 'ORDER_NOT_HOME_DELIVERY');
  }
}

/** Solo se busca repartidor para pedidos aceptados (en preparación o listos). */
export class DeliveryOrderNotReadyError extends AppError {
  readonly details: { orderStatus: string };

  constructor(orderStatus: string) {
    super('The order must be accepted before finding a courier', 409, 'DELIVERY_ORDER_NOT_READY');
    this.details = { orderStatus };
  }
}

export class DeliveryTransferNotConfirmedError extends AppError {
  constructor() {
    super(
      'Mark the transfer as received before finding a courier',
      409,
      'DELIVERY_TRANSFER_NOT_CONFIRMED',
    );
  }
}

export class OrderNotTransferError extends AppError {
  constructor() {
    super('The order is not paid by transfer', 409, 'ORDER_NOT_TRANSFER');
  }
}

export class OrderCancelledError extends AppError {
  constructor() {
    super('The order is cancelled', 409, 'ORDER_CANCELLED');
  }
}

export class DeliveryNotFoundError extends AppError {
  constructor() {
    super('The order has no delivery', 404, 'DELIVERY_NOT_FOUND');
  }
}

export class DeliveryAlreadyAcceptedError extends AppError {
  constructor() {
    super('A courier already took this delivery', 409, 'DELIVERY_ALREADY_ACCEPTED');
  }
}

export class DeliveryClosedError extends AppError {
  readonly details: { status: string };

  constructor(status: string) {
    super('This delivery is already closed', 409, 'DELIVERY_CLOSED');
    this.details = { status };
  }
}

/** Otra persona tomó la entrega primero (o ya no está disponible). */
export class DeliveryAlreadyTakenError extends AppError {
  constructor() {
    super('This delivery was already taken', 409, 'DELIVERY_ALREADY_TAKEN');
  }
}

/** Token desconocido: nunca existió o fue reemplazado (liberar / compartir de nuevo). */
export class DeliveryLinkNotFoundError extends AppError {
  constructor() {
    super('This delivery link is not valid', 404, 'DELIVERY_LINK_NOT_FOUND');
  }
}

export class DeliveryLinkExpiredError extends AppError {
  constructor() {
    super('This delivery link expired', 410, 'DELIVERY_LINK_EXPIRED');
  }
}

export class DeliveryDestinationInvalidError extends AppError {
  constructor() {
    super('Delivery location is missing or invalid', 400, 'DELIVERY_DESTINATION_INVALID');
  }
}
