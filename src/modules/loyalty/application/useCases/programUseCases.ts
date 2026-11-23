import { LoyaltyProgramInvalidError } from '../../domain/errors/LoyaltyErrors.js';
import { LOYALTY_DESIGN_VERSION, type LoyaltyDesign } from '../../domain/loyaltyDesign.js';
import {
  defaultRewardLabel,
  type LoyaltyProgramConfig,
  type LoyaltyRewardType,
  type LoyaltyStampMode,
} from '../../domain/loyaltyProgram.js';
import type { LoyaltyProgramRecord, LoyaltyRepository } from '../ports/LoyaltyRepository.js';
import { ownerBusiness } from './loyaltyAccess.js';

/** Configuración y diseño. Si no existe, valores por defecto SIN crear nada. */
export class GetLoyaltyProgram {
  constructor(private readonly repository: LoyaltyRepository) {}

  async execute(ownerUserId: string): Promise<LoyaltyProgramRecord> {
    const business = await ownerBusiness(this.repository, ownerUserId);
    return this.repository.getProgram(business);
  }
}

/** Entrada ya validada por el esquema HTTP (listas cerradas, rangos y colores hex). */
export interface SaveLoyaltyProgramInput {
  enabled: boolean;
  stampsRequired: number;
  stampMode: LoyaltyStampMode;
  minOrderAmount: number;
  rewardType: LoyaltyRewardType;
  rewardValue: number;
  rewardProductId: string | null;
  rewardLabel: string | null;
  rewardExpiresDays: number | null;
  walkInDailyLimit: number;
  design: LoyaltyDesign;
}

/**
 * Guarda configuración y diseño. Desactivar (enabled: false) conserva tarjetas, sellos y
 * premios: solo deja de mostrarse y de sellar.
 */
export class SaveLoyaltyProgram {
  constructor(private readonly repository: LoyaltyRepository) {}

  async execute(
    ownerUserId: string,
    input: SaveLoyaltyProgramInput,
  ): Promise<LoyaltyProgramRecord> {
    const business = await ownerBusiness(this.repository, ownerUserId);
    let productName: string | null = null;
    let rewardProductId: string | null = null;
    if (input.rewardType === 'FREE_PRODUCT') {
      const product = input.rewardProductId
        ? await this.repository.findProduct(business.id, input.rewardProductId)
        : null;
      if (!product)
        throw new LoyaltyProgramInvalidError('rewardProductId', 'Elige un producto de tu menú.');
      productName = product.name;
      rewardProductId = product.id;
    }
    const rewardValue = input.rewardType === 'FREE_PRODUCT' ? 0 : input.rewardValue;
    const config: LoyaltyProgramConfig = {
      enabled: input.enabled,
      stampsRequired: input.stampsRequired,
      stampMode: input.stampMode,
      minOrderAmount: input.minOrderAmount,
      rewardType: input.rewardType,
      rewardValue,
      rewardProductId,
      rewardLabel:
        input.rewardLabel?.trim() || defaultRewardLabel(input.rewardType, rewardValue, productName),
      rewardExpiresDays: input.rewardExpiresDays,
      walkInDailyLimit: input.walkInDailyLimit,
      design: input.design,
      designVersion: LOYALTY_DESIGN_VERSION,
    };
    return this.repository.saveProgram(business, config);
  }
}
