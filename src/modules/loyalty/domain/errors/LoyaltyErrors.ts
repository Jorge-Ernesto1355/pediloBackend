import { AppError } from '@/shared/errors/app-error.js';

/*
 * Errores de lealtad: mensajes breves en español, sin detalles internos. Nunca incluyen
 * el token de la tarjeta ni datos del cliente.
 */

export class LoyaltyBusinessNotFoundError extends AppError {
  constructor() {
    super('No encontramos tu negocio.', 404, 'BUSINESS_NOT_FOUND');
  }
}

export class LoyaltyProgramInactiveError extends AppError {
  constructor() {
    super('El programa de lealtad no está activo.', 409, 'LOYALTY_PROGRAM_INACTIVE');
  }
}

export class LoyaltyProgramInvalidError extends AppError {
  readonly details: { field: string };

  constructor(field: string, message: string) {
    super(message, 400, 'LOYALTY_PROGRAM_INVALID');
    this.details = { field };
  }
}

export class LoyaltyCustomerNotFoundError extends AppError {
  constructor() {
    super('No encontramos a este cliente.', 404, 'CUSTOMER_NOT_FOUND');
  }
}

export class LoyaltyOrderNotFoundError extends AppError {
  constructor() {
    super('No encontramos este pedido.', 404, 'ORDER_NOT_FOUND');
  }
}

/** Misma respuesta para token inválido, inexistente o de otro restaurante. */
export class LoyaltyCardNotFoundError extends AppError {
  constructor() {
    super('No encontramos esta tarjeta.', 404, 'LOYALTY_CARD_NOT_FOUND');
  }
}

export class LoyaltyStampNotFoundError extends AppError {
  constructor() {
    super('No encontramos este sello.', 404, 'LOYALTY_STAMP_NOT_FOUND');
  }
}

export class LoyaltyRewardNotFoundError extends AppError {
  constructor() {
    super('No encontramos este premio.', 404, 'LOYALTY_REWARD_NOT_FOUND');
  }
}

export type OrderNotStampableReason =
  'ORDER_NOT_FINISHED' | 'ORDER_CANCELLED' | 'ORDER_WITHOUT_CUSTOMER' | 'ORDER_BELOW_MINIMUM';

const NOT_STAMPABLE_MESSAGES: Record<OrderNotStampableReason, string> = {
  ORDER_NOT_FINISHED: 'El pedido se sella cuando está finalizado.',
  ORDER_CANCELLED: 'Un pedido cancelado no se sella.',
  ORDER_WITHOUT_CUSTOMER: 'Vincula un cliente al pedido para darle su sello.',
  ORDER_BELOW_MINIMUM: 'El pedido no alcanza el monto mínimo para sellar.',
};

export class LoyaltyOrderNotStampableError extends AppError {
  readonly details: { reason: OrderNotStampableReason; minOrderAmount?: number };

  constructor(reason: OrderNotStampableReason, minOrderAmount?: number) {
    super(NOT_STAMPABLE_MESSAGES[reason], 422, 'LOYALTY_ORDER_NOT_STAMPABLE');
    this.details = { reason, ...(minOrderAmount !== undefined ? { minOrderAmount } : {}) };
  }
}

/** Para vincular un cliente, el pedido no debe tener ya uno. */
export class LoyaltyOrderAlreadyHasCustomerError extends AppError {
  constructor() {
    super('Este pedido ya tiene un cliente.', 409, 'LOYALTY_ORDER_HAS_CUSTOMER');
  }
}

export class LoyaltyCustomerDisabledError extends AppError {
  constructor() {
    super('Este cliente está desactivado.', 409, 'CUSTOMER_DISABLED');
  }
}

export class LoyaltyWalkInLimitError extends AppError {
  readonly details: { limit: number };

  constructor(limit: number) {
    super(`Este cliente ya recibió ${limit} sellos en el local hoy.`, 429, 'LOYALTY_WALK_IN_LIMIT');
    this.details = { limit };
  }
}

export type StampVoidBlockedReason = 'REWARD_REDEEMED' | 'NEWER_STAMPS' | 'STAMP_TOO_OLD';

const VOID_BLOCKED_MESSAGES: Record<StampVoidBlockedReason, string> = {
  REWARD_REDEEMED: 'Este sello completó una tarjeta cuyo premio ya se canjeó; no se puede anular.',
  NEWER_STAMPS: 'Primero anula los sellos más recientes de esta tarjeta.',
  STAMP_TOO_OLD: 'Este sello pertenece a una tarjeta anterior y ya no se puede anular.',
};

export class LoyaltyStampVoidBlockedError extends AppError {
  readonly details: { reason: StampVoidBlockedReason };

  constructor(reason: StampVoidBlockedReason) {
    super(VOID_BLOCKED_MESSAGES[reason], 409, 'LOYALTY_STAMP_VOID_BLOCKED');
    this.details = { reason };
  }
}

export type RewardUnavailableReason =
  'REDEEMED' | 'EXPIRED' | 'VOID' | 'PRODUCT_UNAVAILABLE' | 'NOT_FOUND' | 'PROGRAM_INACTIVE';

const REWARD_UNAVAILABLE_MESSAGES: Record<RewardUnavailableReason, string> = {
  REDEEMED: 'Este premio ya se canjeó.',
  EXPIRED: 'Este premio ya venció.',
  VOID: 'Este premio se anuló.',
  PRODUCT_UNAVAILABLE: 'El producto del premio ya no está disponible.',
  NOT_FOUND: 'No encontramos este premio.',
  PROGRAM_INACTIVE: 'El programa de lealtad no está activo.',
};

/**
 * El premio no se puede aplicar. En el checkout se responde con el descuento esperado y
 * el vigente (0) para que el cliente confirme el nuevo total; el pedido NO se crea.
 */
export class LoyaltyRewardUnavailableError extends AppError {
  readonly details: {
    reason: RewardUnavailableReason;
    expectedDiscount?: number;
    currentDiscount: number;
  };

  constructor(reason: RewardUnavailableReason, expectedDiscount?: number) {
    super(REWARD_UNAVAILABLE_MESSAGES[reason], 409, 'LOYALTY_REWARD_UNAVAILABLE');
    this.details = {
      reason,
      ...(expectedDiscount !== undefined ? { expectedDiscount } : {}),
      currentDiscount: 0,
    };
  }
}

/** El descuento del premio recalculado no coincide con el que vio el cliente. */
export class LoyaltyRewardChangedError extends AppError {
  readonly details: { expectedDiscount: number; currentDiscount: number };

  constructor(expectedDiscount: number, currentDiscount: number) {
    super('El descuento de tu premio cambió.', 409, 'LOYALTY_REWARD_CHANGED');
    this.details = { expectedDiscount, currentDiscount };
  }
}

/** Un premio por pedido. */
export class LoyaltyOrderAlreadyHasRewardError extends AppError {
  constructor() {
    super(
      'Este pedido ya tiene un premio o descuento de cliente aplicado.',
      409,
      'LOYALTY_ORDER_HAS_REWARD',
    );
  }
}

export class LoyaltyRewardOrderMismatchError extends AppError {
  readonly details: { reason: 'OTHER_CUSTOMER' | 'ORDER_NOT_EDITABLE' };

  constructor(reason: 'OTHER_CUSTOMER' | 'ORDER_NOT_EDITABLE') {
    super(
      reason === 'OTHER_CUSTOMER'
        ? 'El premio es de otro cliente.'
        : 'Solo se aplica un premio a pedidos pendientes o en preparación.',
      409,
      'LOYALTY_REWARD_ORDER_MISMATCH',
    );
    this.details = { reason };
  }
}
