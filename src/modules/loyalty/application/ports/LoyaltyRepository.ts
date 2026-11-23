import type { LoyaltyDesign } from '../../domain/loyaltyDesign.js';
import type {
  LoyaltyProgramConfig,
  LoyaltyRewardStatus,
  LoyaltyRewardType,
  LoyaltyStampSource,
} from '../../domain/loyaltyProgram.js';
import type { OrderNotStampableReason } from '../../domain/errors/LoyaltyErrors.js';

export interface OwnerBusiness {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export interface RewardProductInfo {
  id: string;
  name: string;
  price: number;
  isAvailable: boolean;
}

export interface LoyaltyProgramRecord extends LoyaltyProgramConfig {
  /** false = todavía no existe: son los valores por defecto (no se creó nada). */
  exists: boolean;
  rewardProduct: RewardProductInfo | null;
  updatedAt: Date | null;
}

export interface CardSummaryView {
  id: string;
  customerId: string;
  stampsCount: number;
  cyclesCompleted: number;
  stampsRequired: number;
}

export interface StampView {
  id: string;
  cycle: number;
  position: number;
  source: LoyaltyStampSource;
  createdAt: Date;
}

export interface RewardView {
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

export type StampOrderResult =
  | {
      kind: 'STAMPED' | 'ALREADY_STAMPED';
      stamp: StampView;
      card: CardSummaryView;
      reward: RewardView | null;
      customerFirstName: string | null;
    }
  | { kind: 'NOT_STAMPABLE'; reason: OrderNotStampableReason; minOrderAmount: number }
  | { kind: 'PROGRAM_INACTIVE' };

export interface StampResult {
  stamp: StampView;
  card: CardSummaryView;
  reward: RewardView | null;
  customerFirstName: string | null;
}

export interface VoidResult {
  stampId: string;
  orderId: string | null;
  card: CardSummaryView;
  voidedRewardId: string | null;
}

export type LoyaltyCardFilter = 'all' | 'near' | 'reward';

export interface ListCardsQuery {
  search?: string;
  filter: LoyaltyCardFilter;
  customerIds?: string[];
  page: number;
  limit: number;
}

export interface CardListItem {
  id: string;
  customer: { id: string; name: string | null; phone: string };
  stampsCount: number;
  cyclesCompleted: number;
  availableRewards: number;
  lastStampAt: Date | null;
}

export interface LoyaltySummary {
  activeCards: number;
  stampsThisWeek: number;
  pendingRewards: number;
}

export interface CardHistoryStamp extends StampView {
  orderId: string | null;
  orderNumber: number | null;
  note: string | null;
  createdBy: string | null;
  voidedAt: Date | null;
  voidedReason: string | null;
  voidedBy: string | null;
}

export interface CardHistoryReward extends RewardView {
  redeemedAt: Date | null;
  redeemedOrderNumber: number | null;
  voidedAt: Date | null;
}

export interface CardDetail {
  card: CardSummaryView & {
    customer: { id: string; name: string | null; phone: string };
    /** El dueño lo usa para compartir el link; nunca se acepta en sus rutas. */
    cardToken: string;
    createdAt: Date;
  };
  stamps: CardHistoryStamp[];
  rewards: CardHistoryReward[];
  walkInStampsToday: number;
}

export interface RedeemResult {
  reward: RewardView;
  order: { id: string; total: number; loyaltyDiscountAmount: number } | null;
}

export type PublicCardView =
  | {
      status: 'ACTIVE';
      card: {
        customerFirstName: string | null;
        stampsCount: number;
        stampsRequired: number;
        cyclesCompleted: number;
        rewards: Array<Pick<RewardView, 'id' | 'type' | 'label' | 'productName' | 'expiresAt'>>;
        recentStamps: Array<{ createdAt: Date }>;
      };
      program: { rewardLabel: string; stampsRequired: number; minOrderAmount: number };
      design: LoyaltyDesign;
      restaurant: { name: string; slug: string; logoUrl: string | null };
    }
  | { status: 'PAUSED'; restaurant: { name: string; slug: string; logoUrl: string | null } };

export interface PublicProgramView {
  stampsRequired: number;
  rewardType: LoyaltyRewardType;
  rewardValue: number;
  rewardLabel: string;
  minOrderAmount: number;
  design: LoyaltyDesign;
  restaurant: { name: string; logoUrl: string | null };
}

export interface RewardQuote {
  /** false = el restaurante pausó el programa (la tarjeta y sus sellos se conservan). */
  programActive: boolean;
  card: { stampsCount: number; stampsRequired: number };
  reward: Pick<RewardView, 'id' | 'type' | 'value' | 'label' | 'productName' | 'expiresAt'> | null;
  discount: number;
  freeProduct: { id: string; name: string; price: number } | null;
  /** Premio disponible que no aplica (p. ej. su producto ya no está en el menú). */
  unavailableReason: 'PRODUCT_UNAVAILABLE' | null;
}

export interface LoyaltyRepository {
  findOwnerBusiness(ownerUserId: string): Promise<OwnerBusiness | null>;
  getProgram(business: OwnerBusiness): Promise<LoyaltyProgramRecord>;
  findProduct(businessId: string, productId: string): Promise<RewardProductInfo | null>;
  saveProgram(business: OwnerBusiness, config: LoyaltyProgramConfig): Promise<LoyaltyProgramRecord>;
  listCards(
    businessId: string,
    query: ListCardsQuery,
    now: Date,
  ): Promise<{ cards: CardListItem[]; total: number; stampsRequired: number }>;
  summary(businessId: string, now: Date): Promise<LoyaltySummary>;
  /** Crea la tarjeta si el cliente no tiene y `createIfMissing`; null si no hay programa. */
  getCardDetail(
    businessId: string,
    customerId: string,
    options: { createIfMissing: boolean },
    now: Date,
  ): Promise<CardDetail | null>;
  stampOrder(input: {
    businessId: string;
    orderId: string;
    userId: string;
    linkCustomer?: { name: string; phone: string };
    now: Date;
  }): Promise<StampOrderResult>;
  addWalkInStamp(input: {
    businessId: string;
    customerId: string;
    note: string | null;
    userId: string;
    now: Date;
  }): Promise<StampResult>;
  voidStamp(input: {
    businessId: string;
    stampId?: string;
    orderId?: string;
    reason: string;
    userId: string;
    now: Date;
  }): Promise<VoidResult>;
  redeemReward(input: {
    businessId: string;
    rewardId: string;
    orderId: string | null;
    userId: string;
    now: Date;
  }): Promise<RedeemResult>;
  rotateCardToken(businessId: string, customerId: string): Promise<{ cardToken: string } | null>;
  findPublicCard(token: string, now: Date): Promise<PublicCardView | null>;
  findPublicProgram(slug: string): Promise<PublicProgramView | null>;
  quoteReward(input: {
    slug: string;
    cardToken: string;
    subtotal: number;
    now: Date;
  }): Promise<RewardQuote | null>;
}
