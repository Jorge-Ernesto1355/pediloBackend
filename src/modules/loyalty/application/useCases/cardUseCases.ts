import {
  LoyaltyCardNotFoundError,
  LoyaltyProgramInactiveError,
} from '../../domain/errors/LoyaltyErrors.js';
import type {
  CardDetail,
  CardListItem,
  ListCardsQuery,
  LoyaltyRepository,
  LoyaltySummary,
  PublicCardView,
  PublicProgramView,
  RewardQuote,
} from '../ports/LoyaltyRepository.js';
import { type Clock, ownerBusiness, systemClock } from './loyaltyAccess.js';

export class ListLoyaltyCards {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(
    ownerUserId: string,
    query: ListCardsQuery,
  ): Promise<{ cards: CardListItem[]; total: number; stampsRequired: number }> {
    const business = await ownerBusiness(this.repository, ownerUserId);
    return this.repository.listCards(business.id, query, this.clock());
  }
}

/** Métricas de Clientes: tarjetas activas, sellos de esta semana y premios pendientes. */
export class GetLoyaltySummary {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(ownerUserId: string): Promise<LoyaltySummary> {
    const business = await ownerBusiness(this.repository, ownerUserId);
    return this.repository.summary(business.id, this.clock());
  }
}

/**
 * Detalle de la tarjeta de un cliente (sellos, historial y premios).
 * Con el programa activo la crea si el cliente no tiene (creación perezosa). Con el
 * programa desactivado solo se lee una tarjeta que ya exista.
 */
export class GetLoyaltyCard {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(ownerUserId: string, customerId: string): Promise<CardDetail> {
    const business = await ownerBusiness(this.repository, ownerUserId);
    const program = await this.repository.getProgram(business);
    if (!program.exists) throw new LoyaltyProgramInactiveError();
    const detail = await this.repository.getCardDetail(
      business.id,
      customerId,
      { createIfMissing: program.enabled },
      this.clock(),
    );
    if (!detail) throw new LoyaltyProgramInactiveError();
    return detail;
  }
}

/** Regenera el link privado de un cliente; el anterior deja de funcionar. */
export class RotateLoyaltyCardToken {
  constructor(private readonly repository: LoyaltyRepository) {}

  async execute(ownerUserId: string, customerId: string): Promise<{ cardToken: string }> {
    const business = await ownerBusiness(this.repository, ownerUserId);
    const rotated = await this.repository.rotateCardToken(business.id, customerId);
    if (!rotated) throw new LoyaltyCardNotFoundError();
    return rotated;
  }
}

/** Tarjeta para el cliente (link privado). Misma respuesta 404 para cualquier token inválido. */
export class GetPublicLoyaltyCard {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(token: string): Promise<PublicCardView> {
    const card = await this.repository.findPublicCard(token, this.clock());
    if (!card) throw new LoyaltyCardNotFoundError();
    return card;
  }
}

/** Resumen público del programa (menú y checkout), sin datos de ningún cliente. */
export class GetPublicLoyaltyProgram {
  constructor(private readonly repository: LoyaltyRepository) {}

  execute(slug: string): Promise<PublicProgramView | null> {
    return this.repository.findPublicProgram(slug);
  }
}

/** Premio disponible y su descuento para el checkout (lo vuelve a validar el pedido). */
export class QuoteLoyaltyReward {
  constructor(
    private readonly repository: LoyaltyRepository,
    private readonly clock: Clock = systemClock,
  ) {}

  async execute(slug: string, cardToken: string, subtotal: number): Promise<RewardQuote> {
    const quote = await this.repository.quoteReward({
      slug,
      cardToken,
      subtotal,
      now: this.clock(),
    });
    if (!quote) throw new LoyaltyCardNotFoundError();
    return quote;
  }
}
