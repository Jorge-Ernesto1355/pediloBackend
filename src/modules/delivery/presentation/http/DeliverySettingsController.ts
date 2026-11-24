import type { NextFunction, Request, Response } from 'express';
import type { GetDeliverySettings } from '../../application/useCases/GetDeliverySettings.js';
import type { QuoteDelivery } from '../../application/useCases/QuoteDelivery.js';
import type { UpdateDeliverySettings } from '../../application/useCases/UpdateDeliverySettings.js';
import type { DeliverySettings } from '../../domain/deliverySettings.js';
import { ROUTE_FACTOR } from '../../domain/distance.js';
import {
  businessIdParamsSchema,
  quoteDeliverySchema,
  updateDeliverySettingsSchema,
} from './delivery.schemas.js';
import { sendDeliveryError, sendValidationError } from './delivery-http.js';

export class DeliverySettingsController {
  constructor(
    private readonly getSettings: GetDeliverySettings,
    private readonly updateSettings: UpdateDeliverySettings,
    private readonly quoteDelivery: QuoteDelivery,
  ) {}

  get = (request: Request, response: Response, next: NextFunction): void => {
    this.getSettings
      .execute(request.user!.id)
      .then((settings) => response.json({ deliverySettings: toResponse(settings) }))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  update = (request: Request, response: Response, next: NextFunction): void => {
    const parsed = updateDeliverySettingsSchema.safeParse(request.body);
    if (!parsed.success) return void sendValidationError(response, parsed.error);
    this.updateSettings
      .execute(request.user!.id, parsed.data)
      .then((settings) => response.json({ deliverySettings: toResponse(settings) }))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };

  quote = (request: Request, response: Response, next: NextFunction): void => {
    const params = businessIdParamsSchema.safeParse(request.params);
    if (!params.success) return void sendValidationError(response, params.error);
    const body = quoteDeliverySchema.safeParse(request.body);
    if (!body.success) {
      // Sin pin (o pin inválido) es un caso esperado del checkout: código propio y claro.
      response.status(400).json({
        error: {
          code: 'DELIVERY_DESTINATION_INVALID',
          message: 'Delivery location is missing or invalid',
        },
      });
      return;
    }
    this.quoteDelivery
      .execute(params.data.businessId, body.data)
      .then((quote) => response.json({ quote }))
      .catch((error: unknown) => sendDeliveryError(response, error, next));
  };
}

function toResponse(settings: DeliverySettings) {
  // routeFactor permite al panel dibujar el área aproximada (línea recta) del radio máximo.
  return { ...settings, routeFactor: ROUTE_FACTOR };
}
