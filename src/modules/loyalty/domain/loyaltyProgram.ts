import type { LoyaltyDesign } from './loyaltyDesign.js';
import { defaultLoyaltyDesign, LOYALTY_DESIGN_VERSION } from './loyaltyDesign.js';

export type LoyaltyStampMode = 'MANUAL' | 'AUTO';
export type LoyaltyRewardType = 'PERCENT' | 'FIXED' | 'FREE_PRODUCT';
export type LoyaltyStampSource = 'ORDER_MANUAL' | 'ORDER_AUTO' | 'WALK_IN';
export type LoyaltyRewardStatus = 'AVAILABLE' | 'REDEEMED' | 'EXPIRED' | 'VOID';

/** Límites compartidos por el servidor, la base (CHECKs) y el editor del frontend. */
export const LOYALTY_LIMITS = {
  stampsRequired: { min: 3, max: 20 },
  percent: { min: 1, max: 100 },
  fixed: { min: 1, max: 10_000 },
  minOrderAmount: { min: 0, max: 100_000 },
  rewardExpiresDays: { min: 1, max: 365 },
  walkInDailyLimit: { min: 1, max: 20 },
  rewardLabelMaxLength: 40,
  noteMaxLength: 140,
  reasonMaxLength: 140,
} as const;

export interface LoyaltyProgramConfig {
  enabled: boolean;
  stampsRequired: number;
  stampMode: LoyaltyStampMode;
  minOrderAmount: number;
  rewardType: LoyaltyRewardType;
  /** Porcentaje (PERCENT), monto en pesos (FIXED) o 0 (FREE_PRODUCT). */
  rewardValue: number;
  rewardProductId: string | null;
  rewardLabel: string;
  rewardExpiresDays: number | null;
  walkInDailyLimit: number;
  design: LoyaltyDesign;
  designVersion: number;
}

/** Valores por defecto: 8 sellos, manual, 20% de descuento, sin caducidad. */
export function defaultLoyaltyProgram(restaurantName: string): LoyaltyProgramConfig {
  return {
    enabled: true,
    stampsRequired: 8,
    stampMode: 'MANUAL',
    minOrderAmount: 0,
    rewardType: 'PERCENT',
    rewardValue: 20,
    rewardProductId: null,
    rewardLabel: defaultRewardLabel('PERCENT', 20, null),
    rewardExpiresDays: null,
    walkInDailyLimit: 5,
    design: defaultLoyaltyDesign(restaurantName),
    designVersion: LOYALTY_DESIGN_VERSION,
  };
}

function formatPesos(value: number): string {
  return Number.isInteger(value) ? `$${value}` : `$${value.toFixed(2)}`;
}

/** Nombre visible del premio cuando el dueño no escribe uno. */
export function defaultRewardLabel(
  type: LoyaltyRewardType,
  value: number,
  productName: string | null,
): string {
  const label =
    type === 'PERCENT'
      ? `${value}% de descuento`
      : type === 'FIXED'
        ? `${formatPesos(value)} de descuento`
        : `${productName ?? 'Producto'} gratis`;
  return label.slice(0, LOYALTY_LIMITS.rewardLabelMaxLength).trim();
}
