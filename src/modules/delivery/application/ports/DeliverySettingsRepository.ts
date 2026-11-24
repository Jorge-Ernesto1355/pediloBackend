import type { Coordinates } from '../../domain/distance.js';
import type { DeliverySettings } from '../../domain/deliverySettings.js';
import type { DeliveryFeeConfig } from '../../domain/feePolicy.js';

export interface SaveDeliverySettingsInput {
  enabled: boolean;
  maxDeliveryKm: number | null;
  feeConfig: DeliveryFeeConfig | null;
  /** Solo se envía cuando cambia la ubicación del restaurante (Business.ubicationMaps). */
  origin?: Coordinates;
}

export interface DeliverySettingsRepository {
  findBusinessIdByUserId(userId: string): Promise<string | null>;
  /** null si el negocio no existe. Sin fila de ajustes devuelve la configuración por defecto. */
  getByBusinessId(businessId: string): Promise<DeliverySettings | null>;
  save(businessId: string, input: SaveDeliverySettingsInput): Promise<DeliverySettings>;
}
