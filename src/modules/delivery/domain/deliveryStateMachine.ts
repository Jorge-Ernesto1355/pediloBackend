import { DeliveryInvalidTransitionError } from './errors/DeliveryErrors.js';

export type DeliveryStatus =
  'PENDING' | 'ACCEPTED' | 'PICKED_UP' | 'DELIVERED' | 'FAILED' | 'CANCELLED';

export type DeliveryFailureReason =
  'CUSTOMER_UNREACHABLE' | 'WRONG_ADDRESS' | 'CUSTOMER_REJECTED' | 'OTHER';

export const DELIVERY_FAILURE_REASONS: readonly DeliveryFailureReason[] = [
  'CUSTOMER_UNREACHABLE',
  'WRONG_ADDRESS',
  'CUSTOMER_REJECTED',
  'OTHER',
];

/**
 * Transiciones válidas. Cualquier otra se rechaza.
 * - PENDING → ACCEPTED: la toma un repartidor (atómico).
 * - ACCEPTED → PENDING: el dueño la libera (tokens nuevos).
 * - ACCEPTED → PICKED_UP: el dueño confirma que la entregó y recibió el pago.
 * - PICKED_UP → DELIVERED | FAILED: lo marca el repartidor.
 * - PENDING | ACCEPTED → CANCELLED: el dueño cancela el pedido. PICKED_UP no se cancela.
 */
const transitions: Record<DeliveryStatus, readonly DeliveryStatus[]> = {
  PENDING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['PENDING', 'PICKED_UP', 'CANCELLED'],
  PICKED_UP: ['DELIVERED', 'FAILED'],
  DELIVERED: [],
  FAILED: [],
  CANCELLED: [],
};

export function canTransition(from: DeliveryStatus, to: DeliveryStatus): boolean {
  return transitions[from].includes(to);
}

export function assertTransition(from: DeliveryStatus, to: DeliveryStatus): void {
  if (!canTransition(from, to)) throw new DeliveryInvalidTransitionError(from, to);
}

export const TERMINAL_DELIVERY_STATUSES: readonly DeliveryStatus[] = [
  'DELIVERED',
  'FAILED',
  'CANCELLED',
];

export function isTerminal(status: DeliveryStatus): boolean {
  return TERMINAL_DELIVERY_STATUSES.includes(status);
}

/** Entregas que todavía mueven el pedido (para la comanda y la cancelación). */
export function isActive(status: DeliveryStatus): boolean {
  return status === 'PENDING' || status === 'ACCEPTED' || status === 'PICKED_UP';
}
