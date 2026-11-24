import type { Prisma } from '@prisma/client';
import {
  LoyaltyCustomerNotFoundError,
  LoyaltyOrderAlreadyHasCustomerError,
  LoyaltyOrderNotFoundError,
  LoyaltyProgramInactiveError,
  LoyaltyRewardOrderMismatchError,
  LoyaltyRewardUnavailableError,
  LoyaltyStampNotFoundError,
  LoyaltyStampVoidBlockedError,
  LoyaltyWalkInLimitError,
  type OrderNotStampableReason,
} from '../../domain/errors/LoyaltyErrors.js';
import type {
  LoyaltyRewardStatus,
  LoyaltyRewardType,
  LoyaltyStampMode,
  LoyaltyStampSource,
} from '../../domain/loyaltyProgram.js';
import {
  customerFirstName,
  effectiveRewardStatus,
  orderStampBlocker,
  planStamp,
  planStampVoid,
  rewardExpiresAt,
  startOfBusinessDay,
  type LoyaltyOrderStatus,
} from '../../domain/loyaltyRules.js';
import { generateCardToken, sameCardToken } from '../../domain/loyaltyTokens.js';
import { logLoyaltyError } from '../loyaltyLog.js';

/*
 * Libro de sellos y premios. ÚNICO lugar que escribe sellos, conteos y premios.
 * Todas las funciones reciben la transacción del llamador: el botón manual, el modo
 * automático (dentro de la transacción que finaliza el pedido), la cancelación y el
 * canje comparten exactamente esta lógica.
 *
 * Concurrencia: toda escritura sobre una tarjeta bloquea antes su fila
 * (SELECT ... FOR UPDATE). Además, el índice único parcial
 * loyalty_stamps_active_order_key impide dos sellos vigentes para el mismo pedido y
 * loyalty_rewards.redeemedOrderId es único (un premio por pedido).
 */

type Tx = Prisma.TransactionClient;

export const ORDER_CANCELLED_VOID_REASON = 'pedido cancelado';

export interface LoyaltyProgramRow {
  id: string;
  businessId: string;
  enabled: boolean;
  stampsRequired: number;
  stampMode: LoyaltyStampMode;
  minOrderAmount: number;
  rewardType: LoyaltyRewardType;
  rewardValue: number;
  rewardProductId: string | null;
  rewardLabel: string;
  rewardExpiresDays: number | null;
  walkInDailyLimit: number;
}

export interface StampSummary {
  id: string;
  cycle: number;
  position: number;
  source: LoyaltyStampSource;
  createdAt: Date;
}

export interface CardSummary {
  id: string;
  customerId: string;
  stampsCount: number;
  cyclesCompleted: number;
  stampsRequired: number;
}

export interface RewardSummary {
  id: string;
  status: LoyaltyRewardStatus;
  type: LoyaltyRewardType;
  value: number;
  label: string;
  productId: string | null;
  productName: string | null;
  expiresAt: Date | null;
  createdAt: Date;
}

export type StampOutcome =
  | {
      kind: 'STAMPED' | 'ALREADY_STAMPED';
      stamp: StampSummary;
      card: CardSummary;
      reward: RewardSummary | null;
      customerFirstName: string | null;
    }
  | { kind: 'NOT_STAMPABLE'; reason: OrderNotStampableReason; minOrderAmount: number }
  | { kind: 'PROGRAM_INACTIVE' };

interface LockedCard {
  id: string;
  businessId: string;
  customerId: string;
  stampsCount: number;
  cyclesCompleted: number;
}

const rewardSelect = {
  id: true,
  status: true,
  rewardType: true,
  rewardValue: true,
  rewardLabel: true,
  rewardProductId: true,
  rewardProductName: true,
  expiresAt: true,
  createdAt: true,
} as const;

type RewardRow = Prisma.LoyaltyRewardGetPayload<{ select: typeof rewardSelect }>;

export function toRewardSummary(row: RewardRow, now: Date): RewardSummary {
  return {
    id: row.id,
    status: effectiveRewardStatus({ status: row.status, expiresAt: row.expiresAt }, now),
    type: row.rewardType,
    value: row.rewardValue.toNumber(),
    label: row.rewardLabel,
    productId: row.rewardProductId,
    productName: row.rewardProductName,
    expiresAt: row.expiresAt,
    createdAt: row.createdAt,
  };
}

export async function loadProgramRow(
  tx: Tx,
  businessId: string,
): Promise<LoyaltyProgramRow | null> {
  const row = await tx.loyaltyProgram.findUnique({
    where: { businessId },
    select: {
      id: true,
      businessId: true,
      enabled: true,
      stampsRequired: true,
      stampMode: true,
      minOrderAmount: true,
      rewardType: true,
      rewardValue: true,
      rewardProductId: true,
      rewardLabel: true,
      rewardExpiresDays: true,
      walkInDailyLimit: true,
    },
  });
  if (!row) return null;
  return {
    ...row,
    minOrderAmount: row.minOrderAmount.toNumber(),
    rewardValue: row.rewardValue.toNumber(),
  };
}

export async function businessTimezone(tx: Tx, businessId: string): Promise<string> {
  const settings = await tx.businessSettings.findUnique({
    where: { businessId },
    select: { timezone: true },
  });
  return settings?.timezone || 'America/Mazatlan';
}

/**
 * Devuelve la tarjeta del cliente y la crea si no existe (creación perezosa).
 * Bloquea antes la fila del cliente para que dos peticiones simultáneas no intenten
 * crear la misma tarjeta (un error de unicidad abortaría la transacción completa).
 */
export async function ensureCardInTx(
  tx: Tx,
  businessId: string,
  customerId: string,
): Promise<{ id: string; created: boolean }> {
  const customers = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Customer"
    WHERE "id" = ${customerId} AND "businessId" = ${businessId}
    FOR UPDATE`;
  if (customers.length === 0) throw new LoyaltyCustomerNotFoundError();
  const existing = await tx.loyaltyCard.findUnique({
    where: { businessId_customerId: { businessId, customerId } },
    select: { id: true },
  });
  if (existing) return { id: existing.id, created: false };
  const created = await tx.loyaltyCard.create({
    data: { businessId, customerId, publicToken: generateCardToken() },
    select: { id: true },
  });
  return { id: created.id, created: true };
}

export async function lockCardRow(tx: Tx, cardId: string): Promise<LockedCard> {
  const rows = await tx.$queryRaw<LockedCard[]>`
    SELECT "id", "businessId", "customerId", "stampsCount", "cyclesCompleted"
    FROM "loyalty_cards"
    WHERE "id" = ${cardId}
    FOR UPDATE`;
  const card = rows[0];
  if (!card) throw new Error('Loyalty card disappeared while locked');
  return card;
}

/** Inserta el sello sobre una tarjeta YA BLOQUEADA y, si la completa, crea el premio. */
async function appendStamp(
  tx: Tx,
  input: {
    card: LockedCard;
    program: LoyaltyProgramRow;
    source: LoyaltyStampSource;
    orderId: string | null;
    note: string | null;
    createdByUserId: string | null;
    now: Date;
  },
): Promise<{ stamp: StampSummary; card: CardSummary; reward: RewardSummary | null }> {
  const { card, program, now } = input;
  const plan = planStamp(card, program.stampsRequired);
  const stamp = await tx.loyaltyStamp.create({
    data: {
      cardId: card.id,
      businessId: card.businessId,
      orderId: input.orderId,
      source: input.source,
      note: input.note,
      createdByUserId: input.createdByUserId,
      cycle: plan.cycle,
      position: plan.position,
      createdAt: now,
    },
    select: { id: true, cycle: true, position: true, source: true, createdAt: true },
  });

  let reward: RewardSummary | null = null;
  if (plan.completes) {
    // Copia del premio vigente: cambiar el programa después no altera premios ganados.
    const product =
      program.rewardType === 'FREE_PRODUCT' && program.rewardProductId
        ? await tx.product.findUnique({
            where: { id: program.rewardProductId },
            select: { name: true },
          })
        : null;
    const created = await tx.loyaltyReward.create({
      data: {
        cardId: card.id,
        businessId: card.businessId,
        rewardType: program.rewardType,
        rewardValue: program.rewardType === 'FREE_PRODUCT' ? 0 : program.rewardValue,
        rewardProductId: program.rewardType === 'FREE_PRODUCT' ? program.rewardProductId : null,
        rewardProductName: product?.name.slice(0, 120) ?? null,
        rewardLabel: program.rewardLabel,
        cycle: plan.cycle,
        sourceStampId: stamp.id,
        expiresAt: rewardExpiresAt(now, program.rewardExpiresDays),
        createdAt: now,
      },
      select: rewardSelect,
    });
    reward = toRewardSummary(created, now);
  }

  await tx.loyaltyCard.update({
    where: { id: card.id },
    data: { stampsCount: plan.next.stampsCount, cyclesCompleted: plan.next.cyclesCompleted },
  });

  return {
    stamp,
    reward,
    card: {
      id: card.id,
      customerId: card.customerId,
      stampsCount: plan.next.stampsCount,
      cyclesCompleted: plan.next.cyclesCompleted,
      stampsRequired: program.stampsRequired,
    },
  };
}

async function activeStampForOrder(tx: Tx, orderId: string) {
  return tx.loyaltyStamp.findFirst({
    where: { orderId, voidedAt: null },
    select: {
      id: true,
      cycle: true,
      position: true,
      source: true,
      createdAt: true,
      cardId: true,
      reward: { select: rewardSelect },
      card: { select: { customerId: true, stampsCount: true, cyclesCompleted: true } },
    },
  });
}

async function alreadyStamped(
  tx: Tx,
  existing: NonNullable<Awaited<ReturnType<typeof activeStampForOrder>>>,
  program: LoyaltyProgramRow,
  customerName: string | null,
  now: Date,
): Promise<StampOutcome> {
  const card = await tx.loyaltyCard.findUniqueOrThrow({
    where: { id: existing.cardId },
    select: { id: true, customerId: true, stampsCount: true, cyclesCompleted: true },
  });
  return {
    kind: 'ALREADY_STAMPED',
    stamp: {
      id: existing.id,
      cycle: existing.cycle,
      position: existing.position,
      source: existing.source,
      createdAt: existing.createdAt,
    },
    card: { ...card, stampsRequired: program.stampsRequired },
    reward: existing.reward ? toRewardSummary(existing.reward, now) : null,
    customerFirstName: customerFirstName(customerName),
  };
}

/**
 * LA función de sellado de pedidos (botón manual, modo automático y cualquier otra ruta).
 * Idempotente: si el pedido ya tiene un sello vigente, devuelve ese mismo sello.
 * No lanza por reglas de negocio (programa inactivo, pedido no sellable): devuelve el
 * motivo para que el llamador decida (el botón manual responde error; el automático calla).
 */
export async function stampOrderInTx(
  tx: Tx,
  input: {
    businessId: string;
    orderId: string;
    source: 'ORDER_MANUAL' | 'ORDER_AUTO';
    createdByUserId: string | null;
    /** Solo pedidos sin cliente: vincula (o crea) el cliente por teléfono y luego sella. */
    linkCustomer?: { name: string; phone: string };
    now: Date;
  },
): Promise<StampOutcome> {
  const program = await loadProgramRow(tx, input.businessId);
  if (!program?.enabled) return { kind: 'PROGRAM_INACTIVE' };

  const found = await tx.order.findFirst({
    where: { id: input.orderId, businessId: input.businessId },
    select: {
      id: true,
      status: true,
      fulfillmentType: true,
      customerId: true,
      customerName: true,
      total: true,
      customer: { select: { name: true } },
    },
  });
  if (!found) throw new LoyaltyOrderNotFoundError();
  // Nombre del pedido o, si no se capturó, el del cliente vinculado.
  let order = { ...found, customerName: found.customerName ?? found.customer?.name ?? null };

  if (input.linkCustomer) {
    if (order.customerId) throw new LoyaltyOrderAlreadyHasCustomerError();
    const customer = await tx.customer.upsert({
      where: {
        businessId_phone: { businessId: input.businessId, phone: input.linkCustomer.phone },
      },
      create: {
        businessId: input.businessId,
        name: input.linkCustomer.name,
        phone: input.linkCustomer.phone,
      },
      update: {},
      select: { id: true, name: true, phone: true },
    });
    const linked = await tx.order.updateMany({
      where: { id: order.id, businessId: input.businessId, customerId: null },
      data: {
        customerId: customer.id,
        customerName: customer.name ?? input.linkCustomer.name,
        customerPhone: customer.phone,
      },
    });
    if (linked.count !== 1) throw new LoyaltyOrderAlreadyHasCustomerError();
    order = {
      ...order,
      customerId: customer.id,
      customerName: customer.name ?? input.linkCustomer.name,
    };
  }

  const existing = await activeStampForOrder(tx, order.id);
  if (existing) return alreadyStamped(tx, existing, program, order.customerName, input.now);

  const blocker = orderStampBlocker(
    {
      status: order.status as LoyaltyOrderStatus,
      fulfillmentType: order.fulfillmentType,
      customerId: order.customerId,
      total: order.total.toNumber(),
    },
    program,
  );
  if (blocker)
    return { kind: 'NOT_STAMPABLE', reason: blocker, minOrderAmount: program.minOrderAmount };

  const { id: cardId } = await ensureCardInTx(tx, input.businessId, order.customerId!);
  const card = await lockCardRow(tx, cardId);
  // Otra petición pudo sellar este pedido mientras esperábamos el bloqueo.
  const raced = await activeStampForOrder(tx, order.id);
  if (raced) return alreadyStamped(tx, raced, program, order.customerName, input.now);

  const result = await appendStamp(tx, {
    card,
    program,
    source: input.source,
    orderId: order.id,
    note: null,
    createdByUserId: input.createdByUserId,
    now: input.now,
  });
  return { kind: 'STAMPED', ...result, customerFirstName: customerFirstName(order.customerName) };
}

/**
 * Sello automático al finalizar el pedido, dentro de SU transacción.
 * Usa un SAVEPOINT: si algo inesperado falla al sellar, se registra y se deshace solo el
 * sello; el cambio de estado del pedido nunca se bloquea por la tarjeta de lealtad.
 */
export async function autoStampOrderInTx(
  tx: Tx,
  input: { businessId: string; orderId: string; createdByUserId: string | null; now: Date },
): Promise<{ program: LoyaltyProgramRow | null; outcome: StampOutcome | null }> {
  const program = await loadProgramRow(tx, input.businessId);
  if (!program?.enabled) return { program: null, outcome: { kind: 'PROGRAM_INACTIVE' } };
  if (program.stampMode !== 'AUTO') return { program, outcome: null };
  await tx.$executeRawUnsafe('SAVEPOINT loyalty_auto_stamp');
  try {
    const outcome = await stampOrderInTx(tx, {
      businessId: input.businessId,
      orderId: input.orderId,
      source: 'ORDER_AUTO',
      createdByUserId: input.createdByUserId,
      now: input.now,
    });
    await tx.$executeRawUnsafe('RELEASE SAVEPOINT loyalty_auto_stamp');
    return { program, outcome };
  } catch (error) {
    await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT loyalty_auto_stamp');
    logLoyaltyError('auto_stamp', { businessId: input.businessId, orderId: input.orderId }, error);
    return { program, outcome: null };
  }
}

/** Sello en el local (walk_in) con nota opcional y tope diario por cliente. */
export async function addWalkInStampInTx(
  tx: Tx,
  input: {
    businessId: string;
    customerId: string;
    note: string | null;
    createdByUserId: string;
    now: Date;
  },
): Promise<{
  stamp: StampSummary;
  card: CardSummary;
  reward: RewardSummary | null;
  customerFirstName: string | null;
}> {
  const program = await loadProgramRow(tx, input.businessId);
  if (!program?.enabled) throw new LoyaltyProgramInactiveError();
  const customer = await tx.customer.findFirst({
    where: { id: input.customerId, businessId: input.businessId },
    select: { id: true, name: true },
  });
  if (!customer) throw new LoyaltyCustomerNotFoundError();

  const { id: cardId } = await ensureCardInTx(tx, input.businessId, customer.id);
  const card = await lockCardRow(tx, cardId);
  const timezone = await businessTimezone(tx, input.businessId);
  const today = await tx.loyaltyStamp.count({
    where: {
      cardId,
      source: 'WALK_IN',
      voidedAt: null,
      createdAt: { gte: startOfBusinessDay(input.now, timezone) },
    },
  });
  if (today >= program.walkInDailyLimit)
    throw new LoyaltyWalkInLimitError(program.walkInDailyLimit);

  const result = await appendStamp(tx, {
    card,
    program,
    source: 'WALK_IN',
    orderId: null,
    note: input.note,
    createdByUserId: input.createdByUserId,
    now: input.now,
  });
  return { ...result, customerFirstName: customerFirstName(customer.name) };
}

export interface VoidOutcome {
  stampId: string;
  orderId: string | null;
  card: CardSummary;
  voidedRewardId: string | null;
}

/**
 * Anula un sello (nunca se borra). Busca por id de sello o por pedido.
 * - Ciclo en curso: baja el conteo.
 * - Sello del ciclo recién completado con premio sin canjear: el premio pasa a anulado y
 *   la tarjeta vuelve a ese ciclo (normalmente stampsRequired - 1).
 * - Premio ya canjeado o sellos más nuevos: se rechaza con el motivo.
 */
export async function voidStampInTx(
  tx: Tx,
  input: {
    businessId: string;
    stampId?: string;
    orderId?: string;
    reason: string;
    voidedByUserId: string | null;
    now: Date;
  },
): Promise<VoidOutcome> {
  const where = input.stampId
    ? { id: input.stampId, businessId: input.businessId, voidedAt: null }
    : { orderId: input.orderId, businessId: input.businessId, voidedAt: null };
  const found = await tx.loyaltyStamp.findFirst({ where, select: { id: true, cardId: true } });
  if (!found) throw new LoyaltyStampNotFoundError();

  const card = await lockCardRow(tx, found.cardId);
  // Relee con la tarjeta bloqueada: otra petición pudo anularlo mientras esperábamos.
  const stamp = await tx.loyaltyStamp.findFirst({
    where: { id: found.id, voidedAt: null },
    select: { id: true, cycle: true, orderId: true },
  });
  if (!stamp) throw new LoyaltyStampNotFoundError();

  const program = await loadProgramRow(tx, input.businessId);
  const stampsRequired = program?.stampsRequired ?? 8;
  const cycleReward = await tx.loyaltyReward.findFirst({
    where: { cardId: card.id, cycle: stamp.cycle, status: { not: 'VOID' } },
    select: { id: true, status: true },
  });
  const remainingInStampCycle = await tx.loyaltyStamp.count({
    where: { cardId: card.id, cycle: stamp.cycle, voidedAt: null, id: { not: stamp.id } },
  });
  const plan = planStampVoid({
    stampCycle: stamp.cycle,
    card,
    stampsRequired,
    cycleRewardStatus: cycleReward?.status ?? null,
    remainingInStampCycle,
  });
  if (plan.kind === 'BLOCKED') throw new LoyaltyStampVoidBlockedError(plan.reason);

  await tx.loyaltyStamp.update({
    where: { id: stamp.id },
    data: {
      voidedAt: input.now,
      voidedReason: input.reason,
      voidedByUserId: input.voidedByUserId,
    },
  });

  let voidedRewardId: string | null = null;
  if (plan.kind === 'COMPLETED_CYCLE' && plan.voidReward && cycleReward) {
    const voided = await tx.loyaltyReward.updateMany({
      where: { id: cycleReward.id, status: { in: ['AVAILABLE', 'EXPIRED'] } },
      data: { status: 'VOID', voidedAt: input.now },
    });
    // Se canjeó mientras tanto: se revierte todo.
    if (voided.count !== 1) throw new LoyaltyStampVoidBlockedError('REWARD_REDEEMED');
    voidedRewardId = cycleReward.id;
  }

  await tx.loyaltyCard.update({
    where: { id: card.id },
    data: { stampsCount: plan.next.stampsCount, cyclesCompleted: plan.next.cyclesCompleted },
  });

  return {
    stampId: stamp.id,
    orderId: stamp.orderId,
    voidedRewardId,
    card: {
      id: card.id,
      customerId: card.customerId,
      stampsCount: plan.next.stampsCount,
      cyclesCompleted: plan.next.cyclesCompleted,
      stampsRequired,
    },
  };
}

/**
 * Al cancelar un pedido (misma transacción):
 * - Su premio canjeado vuelve a estar disponible.
 * - Su sello vigente se anula con el motivo "pedido cancelado". Con las reglas de estados
 *   actuales un pedido sellado ya no puede cancelarse; esto queda como defensa. Si la
 *   anulación no procede, se registra y la cancelación sigue (SAVEPOINT).
 */
export async function onOrderCancelledInTx(
  tx: Tx,
  input: { businessId: string; orderId: string; userId: string | null; now: Date },
): Promise<{ releasedRewardId: string | null; voidedStampId: string | null }> {
  const redeemed = await tx.loyaltyReward.findFirst({
    where: { redeemedOrderId: input.orderId, businessId: input.businessId, status: 'REDEEMED' },
    select: { id: true },
  });
  if (redeemed) {
    await tx.loyaltyReward.update({
      where: { id: redeemed.id },
      data: {
        status: 'AVAILABLE',
        redeemedAt: null,
        redeemedOrderId: null,
        redeemedByUserId: null,
      },
    });
  }

  let voidedStampId: string | null = null;
  const active = await tx.loyaltyStamp.findFirst({
    where: { orderId: input.orderId, businessId: input.businessId, voidedAt: null },
    select: { id: true },
  });
  if (active) {
    await tx.$executeRawUnsafe('SAVEPOINT loyalty_cancel_void');
    try {
      const outcome = await voidStampInTx(tx, {
        businessId: input.businessId,
        stampId: active.id,
        reason: ORDER_CANCELLED_VOID_REASON,
        voidedByUserId: input.userId,
        now: input.now,
      });
      await tx.$executeRawUnsafe('RELEASE SAVEPOINT loyalty_cancel_void');
      voidedStampId = outcome.stampId;
    } catch (error) {
      await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT loyalty_cancel_void');
      logLoyaltyError(
        'cancel_void_stamp',
        { businessId: input.businessId, orderId: input.orderId },
        error,
      );
    }
  }
  return { releasedRewardId: redeemed?.id ?? null, voidedStampId };
}

export interface LockedReward {
  id: string;
  cardId: string;
  customerId: string;
  businessId: string;
  status: LoyaltyRewardStatus;
  rewardType: LoyaltyRewardType;
  rewardValue: number;
  rewardProductId: string | null;
  rewardProductName: string | null;
  rewardLabel: string;
  expiresAt: Date | null;
}

/**
 * Bloquea el premio para canjearlo y valida que esté disponible, sin caducar y que sea del
 * restaurante (y de la tarjeta del token, si viene). Cualquier problema → error con el
 * motivo y el descuento esperado (0 vigente), para que el pedido no se cree.
 */
export async function lockRewardForRedemption(
  tx: Tx,
  input: {
    businessId: string;
    rewardId: string;
    cardToken?: string;
    customerId?: string;
    expectedDiscount?: number;
    now: Date;
  },
): Promise<LockedReward> {
  const program = await loadProgramRow(tx, input.businessId);
  if (!program?.enabled)
    throw new LoyaltyRewardUnavailableError('PROGRAM_INACTIVE', input.expectedDiscount);

  const rows = await tx.$queryRaw<
    Array<Omit<LockedReward, 'rewardValue'> & { rewardValue: Prisma.Decimal; publicToken: string }>
  >`
    SELECT r."id", r."cardId", c."customerId", r."businessId", r."status", r."rewardType",
           r."rewardValue", r."rewardProductId", r."rewardProductName", r."rewardLabel",
           r."expiresAt", c."publicToken"
    FROM "loyalty_rewards" r
    JOIN "loyalty_cards" c ON c."id" = r."cardId"
    WHERE r."id" = ${input.rewardId} AND r."businessId" = ${input.businessId}
    FOR UPDATE OF r`;
  const row = rows[0];
  if (!row || (input.cardToken !== undefined && !sameCardToken(row.publicToken, input.cardToken)))
    throw new LoyaltyRewardUnavailableError('NOT_FOUND', input.expectedDiscount);
  if (input.customerId !== undefined && row.customerId !== input.customerId)
    throw new LoyaltyRewardOrderMismatchError('OTHER_CUSTOMER');

  const status = effectiveRewardStatus({ status: row.status, expiresAt: row.expiresAt }, input.now);
  if (status !== 'AVAILABLE')
    throw new LoyaltyRewardUnavailableError(status, input.expectedDiscount);

  return {
    id: row.id,
    cardId: row.cardId,
    customerId: row.customerId,
    businessId: row.businessId,
    status: row.status,
    rewardType: row.rewardType,
    rewardValue: Number(row.rewardValue),
    rewardProductId: row.rewardProductId,
    rewardProductName: row.rewardProductName,
    rewardLabel: row.rewardLabel,
    expiresAt: row.expiresAt,
  };
}

/** Producto regalado del premio, solo si sigue disponible en el menú del restaurante. */
export async function availableRewardProduct(
  tx: Tx,
  reward: Pick<LockedReward, 'businessId' | 'rewardProductId'>,
) {
  if (!reward.rewardProductId) return null;
  const product = await tx.product.findFirst({
    where: { id: reward.rewardProductId, businessId: reward.businessId, isAvailable: true },
    select: { id: true, name: true, price: true },
  });
  return product ? { id: product.id, name: product.name, price: product.price.toNumber() } : null;
}

/** Marca el premio como canjeado (condicionado a que siga disponible). */
export async function markRewardRedeemedInTx(
  tx: Tx,
  input: { rewardId: string; orderId: string | null; userId: string | null; now: Date },
): Promise<void> {
  const changed = await tx.loyaltyReward.updateMany({
    where: { id: input.rewardId, status: 'AVAILABLE' },
    data: {
      status: 'REDEEMED',
      redeemedAt: input.now,
      redeemedOrderId: input.orderId,
      redeemedByUserId: input.userId,
    },
  });
  if (changed.count !== 1) throw new LoyaltyRewardUnavailableError('REDEEMED');
}
