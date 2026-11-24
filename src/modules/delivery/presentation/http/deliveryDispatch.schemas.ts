import { z } from 'zod';
import { phoneSchema } from '@/shared/validation/phone.js';
import { DELIVERY_FAILURE_REASONS } from '../../domain/deliveryStateMachine.js';

export const orderIdParamsSchema = z.object({ orderId: z.string().trim().min(1).max(64) });

/** El formato exacto se valida en el dominio; aquí solo se acota el tamaño. */
export const tokenParamsSchema = z.object({ token: z.string().trim().min(1).max(128) });

export const claimDeliverySchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    phone: phoneSchema,
  })
  .strict();

export const failDeliverySchema = z
  .object({
    reason: z
      .enum(DELIVERY_FAILURE_REASONS as [string, ...string[]])
      .transform((value) => value as (typeof DELIVERY_FAILURE_REASONS)[number]),
  })
  .strict();
