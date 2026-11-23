import { localDate, zonedStart } from '@/shared/time/business-period.js';
import type { OrderNotStampableReason, StampVoidBlockedReason } from './errors/LoyaltyErrors.js';
import type { LoyaltyRewardStatus, LoyaltyRewardType } from './loyaltyProgram.js';

/*
 * Reglas puras de la tarjeta de lealtad. Toda la lógica de sellado, anulación y premios
 * pasa por aquí; la persistencia (transacciones y bloqueos) vive en
 * infrastructure/persistence/loyaltyLedger.ts y NUNCA duplica estas decisiones.
 */

export type LoyaltyOrderStatus =
  'PENDING' | 'PREPARING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface StampableOrder {
  status: LoyaltyOrderStatus;
  fulfillmentType: 'DINE_IN' | 'PICKUP' | 'DELIVERY';
  customerId: string | null;
  /** Comida con descuentos (incluido el premio), sin envío. */
  total: number;
}

/**
 * Marca del producto regalado (premio FREE_PRODUCT) dentro del pedido: va como una opción
 * del renglón para que cocina y el cliente vean cuál es el regalo. El renglón conserva su
 * precio completo y el descuento va aparte en Order.loyaltyDiscountAmount.
 */
export const REWARD_ITEM_OPTION = { name: 'Premio de lealtad', groupName: 'Premio', price: 0 };

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Estado final del pedido: "Entregado" a domicilio; "Listo" en local o para llevar. */
export function finalStatusFor(fulfillmentType: StampableOrder['fulfillmentType']) {
  return fulfillmentType === 'DELIVERY' ? 'DELIVERED' : 'READY';
}

export function isOrderFinished(order: Pick<StampableOrder, 'status' | 'fulfillmentType'>) {
  return order.status === finalStatusFor(order.fulfillmentType);
}

/** Motivo por el que un pedido NO puede sellarse (null si sí puede). */
export function orderStampBlocker(
  order: StampableOrder,
  program: { minOrderAmount: number },
): OrderNotStampableReason | null {
  if (order.status === 'CANCELLED') return 'ORDER_CANCELLED';
  if (!isOrderFinished(order)) return 'ORDER_NOT_FINISHED';
  if (!order.customerId) return 'ORDER_WITHOUT_CUSTOMER';
  if (order.total + 0.005 < program.minOrderAmount) return 'ORDER_BELOW_MINIMUM';
  return null;
}

export interface CardProgress {
  stampsCount: number;
  cyclesCompleted: number;
}

export interface StampPlan {
  /** Ciclo al que pertenece el sello (cyclesCompleted antes de sellar). */
  cycle: number;
  /** Número del sello dentro del ciclo (1..stampsRequired). */
  position: number;
  completes: boolean;
  next: CardProgress;
}

/**
 * Agrega un sello. Si llega a los sellos requeridos, la tarjeta se completa: suma un ciclo
 * y el conteo vuelve a 0 (el premio lo crea quien persiste el plan).
 * Si el dueño bajó los sellos requeridos, una tarjeta que ya los rebasaba se completa con
 * el siguiente sello.
 */
export function planStamp(card: CardProgress, stampsRequired: number): StampPlan {
  const position = card.stampsCount + 1;
  const completes = position >= stampsRequired;
  return {
    cycle: card.cyclesCompleted,
    position,
    completes,
    next: completes
      ? { stampsCount: 0, cyclesCompleted: card.cyclesCompleted + 1 }
      : { stampsCount: position, cyclesCompleted: card.cyclesCompleted },
  };
}

export type StampVoidPlan =
  | { kind: 'CURRENT_CYCLE'; next: CardProgress }
  | { kind: 'COMPLETED_CYCLE'; next: CardProgress; voidReward: boolean }
  | { kind: 'BLOCKED'; reason: StampVoidBlockedReason };

/**
 * Anular un sello:
 * - Del ciclo en curso: se anula y baja el conteo.
 * - Del ciclo recién completado (el anterior): su premio pasa a anulado y la tarjeta
 *   regresa a ese ciclo con los sellos que le quedan (stampsRequired - 1 normalmente).
 *   Solo si el premio no se canjeó y si el ciclo nuevo todavía no tiene sellos.
 * - De ciclos más viejos: no se puede.
 */
export function planStampVoid(input: {
  stampCycle: number;
  card: CardProgress;
  stampsRequired: number;
  /** Premio del ciclo del sello (null si no hay o ya estaba anulado). */
  cycleRewardStatus: LoyaltyRewardStatus | null;
  /** Sellos vigentes del ciclo del sello SIN contar el que se anula. */
  remainingInStampCycle: number;
}): StampVoidPlan {
  const { stampCycle, card } = input;
  if (stampCycle === card.cyclesCompleted) {
    return {
      kind: 'CURRENT_CYCLE',
      next: {
        stampsCount: Math.max(0, card.stampsCount - 1),
        cyclesCompleted: card.cyclesCompleted,
      },
    };
  }
  if (stampCycle !== card.cyclesCompleted - 1) return { kind: 'BLOCKED', reason: 'STAMP_TOO_OLD' };
  if (input.cycleRewardStatus === 'REDEEMED') return { kind: 'BLOCKED', reason: 'REWARD_REDEEMED' };
  if (card.stampsCount > 0) return { kind: 'BLOCKED', reason: 'NEWER_STAMPS' };
  return {
    kind: 'COMPLETED_CYCLE',
    voidReward: input.cycleRewardStatus !== null,
    next: {
      stampsCount: Math.max(0, Math.min(input.remainingInStampCycle, input.stampsRequired - 1)),
      cyclesCompleted: stampCycle,
    },
  };
}

export function rewardExpiresAt(createdAt: Date, expiresDays: number | null): Date | null {
  if (!expiresDays) return null;
  return new Date(createdAt.getTime() + expiresDays * 24 * 60 * 60 * 1000);
}

/** Un premio disponible con fecha vencida se trata como vencido al leerlo. */
export function effectiveRewardStatus(
  reward: { status: LoyaltyRewardStatus; expiresAt: Date | null },
  now: Date,
): LoyaltyRewardStatus {
  if (
    reward.status === 'AVAILABLE' &&
    reward.expiresAt &&
    reward.expiresAt.getTime() <= now.getTime()
  )
    return 'EXPIRED';
  return reward.status;
}

/**
 * Descuento del premio sobre `base` = subtotal ya con descuentos de productos (sin envío).
 * - PERCENT: ese porcentaje.
 * - FIXED: el monto, sin pasar de la base.
 * - FREE_PRODUCT: el precio del producto regalado (que va en el pedido a precio completo),
 *   sin pasar de la base.
 */
export function calculateRewardDiscount(
  reward: { type: LoyaltyRewardType; value: number },
  context: { base: number; freeProductPrice?: number | null },
): number {
  const base = round2(Math.max(0, context.base));
  if (base <= 0) return 0;
  if (reward.type === 'PERCENT') return Math.min(base, round2((base * reward.value) / 100));
  if (reward.type === 'FIXED') return Math.min(base, round2(reward.value));
  return Math.min(base, round2(Math.max(0, context.freeProductPrice ?? 0)));
}

/** Sellos que faltan para el premio (el conteo nunca se muestra por encima del total). */
export function stampsRemaining(stampsCount: number, stampsRequired: number): number {
  return Math.max(0, stampsRequired - Math.min(stampsCount, stampsRequired));
}

/** Solo el primer nombre del cliente (para la página pública). */
export function customerFirstName(name: string | null | undefined): string | null {
  const first = (name ?? '').trim().split(/\s+/)[0] ?? '';
  return first ? first.slice(0, 30) : null;
}

/** Inicio del día en la zona horaria del negocio (para el tope diario de sellos en local). */
export function startOfBusinessDay(now: Date, timezone: string): Date {
  return zonedStart(localDate(now, timezone), timezone);
}

/** Inicio de la semana (lunes) en la zona horaria del negocio. */
export function startOfBusinessWeek(now: Date, timezone: string): Date {
  const today = localDate(now, timezone);
  const weekday = new Date(Date.UTC(today.year, today.month - 1, today.day)).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  const monday = new Date(Date.UTC(today.year, today.month - 1, today.day - daysSinceMonday));
  return zonedStart(
    { year: monday.getUTCFullYear(), month: monday.getUTCMonth() + 1, day: monday.getUTCDate() },
    timezone,
  );
}
