/**
 * Estructura de tarifa de envío. Se guarda como JSON en BusinessSettings.deliveryFeeConfig.
 * Es una unión discriminada por `type` para poder agregar otras estructuras (p. ej. fórmula)
 * sin migrar datos: basta con un nuevo `type` y su caso en `calculateDeliveryFee`.
 */
export interface DistanceTier {
  /** Límite superior INCLUSIVO en km (1 decimal). "Hasta 2 km" incluye 2.0 km. */
  upToKm: number;
  /** Envío en pesos (2 decimales). 100% para el repartidor. */
  fee: number;
}

export interface DistanceTiersFeeConfig {
  type: 'DISTANCE_TIERS';
  tiers: DistanceTier[];
}

export type DeliveryFeeConfig = DistanceTiersFeeConfig;

export const FEE_CONFIG_LIMITS = {
  maxTiers: 10,
  maxKm: 50,
  maxFee: 5000,
} as const;

/**
 * Envío para una distancia YA redondeada a 1 decimal.
 * Devuelve null si ningún tramo cubre la distancia.
 */
export function calculateDeliveryFee(config: DeliveryFeeConfig, distanceKm: number): number | null {
  switch (config.type) {
    case 'DISTANCE_TIERS': {
      const tier = config.tiers.find((candidate) => distanceKm <= candidate.upToKm);
      return tier ? tier.fee : null;
    }
  }
}

/** Distancia máxima que cubre la tarifa. */
export function maxCoveredKm(config: DeliveryFeeConfig): number {
  switch (config.type) {
    case 'DISTANCE_TIERS':
      return config.tiers.at(-1)?.upToKm ?? 0;
  }
}

export type FeeConfigIssue =
  'NO_TIERS' | 'TOO_MANY_TIERS' | 'TIER_KM_INVALID' | 'TIER_KM_NOT_ASCENDING' | 'TIER_FEE_INVALID';

/** Reglas de negocio de la tarifa. La forma del JSON se valida antes (Zod en presentación). */
export function validateFeeConfig(config: DeliveryFeeConfig): FeeConfigIssue[] {
  const issues = new Set<FeeConfigIssue>();
  const { tiers } = config;
  if (tiers.length === 0) issues.add('NO_TIERS');
  if (tiers.length > FEE_CONFIG_LIMITS.maxTiers) issues.add('TOO_MANY_TIERS');
  tiers.forEach((tier, index) => {
    if (!isPositiveWithDecimals(tier.upToKm, 1) || tier.upToKm > FEE_CONFIG_LIMITS.maxKm) {
      issues.add('TIER_KM_INVALID');
    }
    if (!isPositiveWithDecimals(tier.fee, 2) || tier.fee > FEE_CONFIG_LIMITS.maxFee) {
      issues.add('TIER_FEE_INVALID');
    }
    const previous = tiers[index - 1];
    if (previous && tier.upToKm <= previous.upToKm) issues.add('TIER_KM_NOT_ASCENDING');
  });
  return [...issues];
}

/** Lee el JSON guardado. Devuelve null si no existe o no tiene una forma conocida. */
export function parseFeeConfig(value: unknown): DeliveryFeeConfig | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as { type?: unknown; tiers?: unknown };
  if (candidate.type !== 'DISTANCE_TIERS' || !Array.isArray(candidate.tiers)) return null;
  const tiers: DistanceTier[] = [];
  for (const raw of candidate.tiers) {
    if (!raw || typeof raw !== 'object') return null;
    const { upToKm, fee } = raw as { upToKm?: unknown; fee?: unknown };
    if (typeof upToKm !== 'number' || typeof fee !== 'number') return null;
    tiers.push({ upToKm, fee });
  }
  return { type: 'DISTANCE_TIERS', tiers };
}

function isPositiveWithDecimals(value: number, decimals: number): boolean {
  if (!Number.isFinite(value) || value <= 0) return false;
  const factor = 10 ** decimals;
  return Math.abs(Math.round(value * factor) - value * factor) < 1e-6;
}
