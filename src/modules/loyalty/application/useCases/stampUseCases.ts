import {
  LoyaltyOrderNotStampableError,
  LoyaltyProgramInactiveError,
} from '../../domain/errors/LoyaltyErrors.js';
import type {
  LoyaltyRepository,
  RedeemResult,
  StampResult,
  VoidResult,
} from '../ports/LoyaltyRepository.js';
import { type Clock, ownerBusiness, systemClock } from './loyaltyAccess.js';

export type StampOrderResponse = StampResult & { alreadyStamped: boolean };

/**
 * "Dar sello" a un pedido. Idempotente: repetir la petición devuelve el mismo sello.
 * Si el pedido no tiene cliente, puede vincularse uno (nombre y teléfono) en la misma
 * operación.
 */
export class StampOrder {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(
    ownerUserId: string,
    orderId: string,
    linkCustomer?: { name: string; phone: string },
  ): Promise<StampOrderResponse> {
    const business = await ownerBusiness(this.repository, ownerUserId);
    const outcome = await this.repository.stampOrder({
      businessId: business.id,
      orderId,
      userId: ownerUserId,
      linkCustomer,
      now: this.clock(),
    });
    if (outcome.kind === 'PROGRAM_INACTIVE') throw new LoyaltyProgramInactiveError();
    if (outcome.kind === 'NOT_STAMPABLE')
      throw new LoyaltyOrderNotStampableError(
        outcome.reason,
        outcome.reason === 'ORDER_BELOW_MINIMUM' ? outcome.minOrderAmount : undefined,
      );
    return {
      stamp: outcome.stamp,
      card: outcome.card,
      reward: outcome.reward,
      customerFirstName: outcome.customerFirstName,
      alreadyStamped: outcome.kind === 'ALREADY_STAMPED',
    };
  }
}

async function requireActiveProgram(repository: LoyaltyRepository, ownerUserId: string) {
  const business = await ownerBusiness(repository, ownerUserId);
  const program = await repository.getProgram(business);
  if (!program.exists || !program.enabled) throw new LoyaltyProgramInactiveError();
  return business;
}

/** Anula el sello vigente de un pedido, con motivo. */
export class VoidOrderStamp {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(ownerUserId: string, orderId: string, reason: string): Promise<VoidResult> {
    const business = await requireActiveProgram(this.repository, ownerUserId);
    return this.repository.voidStamp({
      businessId: business.id,
      orderId,
      reason,
      userId: ownerUserId,
      now: this.clock(),
    });
  }
}

/** Anula cualquier sello (incluidos los del local) desde el historial de la tarjeta. */
export class VoidLoyaltyStamp {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(ownerUserId: string, stampId: string, reason: string): Promise<VoidResult> {
    const business = await requireActiveProgram(this.repository, ownerUserId);
    return this.repository.voidStamp({
      businessId: business.id,
      stampId,
      reason,
      userId: ownerUserId,
      now: this.clock(),
    });
  }
}

/** Sello en el local (walk_in) para clientes que compran sin pedido en Pedilo. */
export class AddWalkInStamp {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(
    ownerUserId: string,
    customerId: string,
    note: string | null,
  ): Promise<StampResult> {
    const business = await ownerBusiness(this.repository, ownerUserId);
    return this.repository.addWalkInStamp({
      businessId: business.id,
      customerId,
      note,
      userId: ownerUserId,
      now: this.clock(),
    });
  }
}

/** Canje manual del premio (en el local o aplicado a un pedido pendiente del cliente). */
export class RedeemLoyaltyReward {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(
    ownerUserId: string,
    rewardId: string,
    orderId: string | null,
  ): Promise<RedeemResult> {
    const business = await ownerBusiness(this.repository, ownerUserId);
    return this.repository.redeemReward({
      businessId: business.id,
      rewardId,
      orderId,
      userId: ownerUserId,
      now: this.clock(),
    });
  }
}
