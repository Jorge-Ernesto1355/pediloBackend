import { z } from 'zod';
import { FEE_CONFIG_LIMITS } from '../../domain/feePolicy.js';

export const coordinatesSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();

const tierSchema = z
  .object({
    upToKm: z.number().finite().positive().max(FEE_CONFIG_LIMITS.maxKm),
    fee: z.number().finite().positive().max(FEE_CONFIG_LIMITS.maxFee),
  })
  .strict();

// Forma del JSON. Las reglas de negocio (orden de tramos, cobertura del radio, decimales)
// viven en el dominio: validateDeliverySettings.
const feeConfigSchema = z
  .object({
    type: z.literal('DISTANCE_TIERS'),
    tiers: z.array(tierSchema).max(FEE_CONFIG_LIMITS.maxTiers),
  })
  .strict();

export const updateDeliverySettingsSchema = z
  .object({
    enabled: z.boolean(),
    maxDeliveryKm: z.number().finite().positive().max(FEE_CONFIG_LIMITS.maxKm).nullable(),
    feeConfig: feeConfigSchema.nullable(),
    origin: coordinatesSchema.optional(),
  })
  .strict();

export const businessIdParamsSchema = z.object({ businessId: z.string().trim().min(1).max(64) });

export const quoteDeliverySchema = coordinatesSchema;
