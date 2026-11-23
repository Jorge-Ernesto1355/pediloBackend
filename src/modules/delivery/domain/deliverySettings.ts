import { type Coordinates, deliveryDistanceKm, isValidCoordinates } from './distance.js';
import {
  type DeliveryFeeConfig,
  calculateDeliveryFee,
  FEE_CONFIG_LIMITS,
  maxCoveredKm,
  validateFeeConfig,
} from './feePolicy.js';
import {
  DeliveryDestinationInvalidError,
  DeliveryFeeChangedError,
  DeliveryNotConfiguredError,
  DeliveryOutOfRangeError,
  type DeliverySettingsIssue,
  DeliveryUnavailableError,
} from './errors/DeliveryErrors.js';

/** Configuración de envío de un restaurante. El origen es la ubicación del negocio. */
export interface DeliverySettings {
  enabled: boolean;
  origin: Coordinates | null;
  maxDeliveryKm: number | null;
  feeConfig: DeliveryFeeConfig | null;
}

export interface DeliveryQuote {
  distanceKm: number;
  fee: number;
  maxDeliveryKm: number;
}

/**
 * Reglas para guardar la configuración. Desactivado se puede guardar incompleto;
 * activado exige ubicación, radio y una tarifa que cubra todo el radio.
 */
export function validateDeliverySettings(settings: DeliverySettings): DeliverySettingsIssue[] {
  const issues = new Set<DeliverySettingsIssue>();
  const { maxDeliveryKm, feeConfig } = settings;

  if (maxDeliveryKm !== null && !isValidMaxKm(maxDeliveryKm)) issues.add('MAX_KM_INVALID');
  if (feeConfig) validateFeeConfig(feeConfig).forEach((issue) => issues.add(issue));
  if (settings.origin && !isValidCoordinates(settings.origin)) issues.add('ORIGIN_MISSING');

  if (settings.enabled) {
    if (!settings.origin) issues.add('ORIGIN_MISSING');
    if (maxDeliveryKm === null) issues.add('MAX_KM_MISSING');
    if (!feeConfig) issues.add('NO_TIERS');
  }
  if (
    feeConfig &&
    feeConfig.tiers.length > 0 &&
    maxDeliveryKm !== null &&
    isValidMaxKm(maxDeliveryKm) &&
    maxCoveredKm(feeConfig) < maxDeliveryKm
  ) {
    issues.add('TIERS_DO_NOT_COVER_MAX_KM');
  }
  return [...issues];
}

/** Calcula distancia y envío. Lanza errores de dominio si no se puede entregar. */
export function quoteDelivery(settings: DeliverySettings, destination: Coordinates): DeliveryQuote {
  if (!settings.enabled) throw new DeliveryUnavailableError();
  if (!isValidCoordinates(destination)) throw new DeliveryDestinationInvalidError();
  const { origin, maxDeliveryKm, feeConfig } = settings;
  if (!origin || maxDeliveryKm === null || !feeConfig) throw new DeliveryNotConfiguredError();

  const distanceKm = deliveryDistanceKm(origin, destination);
  if (distanceKm > maxDeliveryKm) throw new DeliveryOutOfRangeError(distanceKm, maxDeliveryKm);

  const fee = calculateDeliveryFee(feeConfig, distanceKm);
  // Con una configuración válida no ocurre: el último tramo cubre el radio máximo.
  if (fee === null) throw new DeliveryNotConfiguredError();
  return { distanceKm, fee, maxDeliveryKm };
}

/**
 * Cotiza para crear un pedido y exige que el envío coincida con el que vio el cliente
 * (tolerancia de 1 centavo, igual que la regla de precios de pedidos).
 */
export function confirmDeliveryQuote(
  settings: DeliverySettings,
  destination: Coordinates,
  expectedFee: number,
): DeliveryQuote {
  const quote = quoteDelivery(settings, destination);
  if (Math.abs(quote.fee - expectedFee) >= 0.01) {
    throw new DeliveryFeeChangedError(expectedFee, quote.fee, quote.distanceKm);
  }
  return quote;
}

/** El checkout ofrece "A domicilio" solo si la configuración guardada está completa y válida. */
export function isDeliveryAvailable(settings: DeliverySettings): boolean {
  return (
    settings.enabled &&
    settings.origin !== null &&
    settings.maxDeliveryKm !== null &&
    settings.feeConfig !== null &&
    validateDeliverySettings(settings).length === 0
  );
}

function isValidMaxKm(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value > 0 &&
    value <= FEE_CONFIG_LIMITS.maxKm &&
    Math.abs(Math.round(value * 10) - value * 10) < 1e-6
  );
}
