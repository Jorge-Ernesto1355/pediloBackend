import type { NextFunction, Request, Response } from 'express';
import { CreateBusinessSettings } from '../../application/useCases/CreateBusinessSettings.js';
import { GetBusinessSettings } from '../../application/useCases/GetBusinessSettings.js';
import { UpdateBusinessSettings } from '../../application/useCases/UpdateBusinessSettings.js';
import { BusinessSettingsError } from '../../domain/errors/BusinessSettingsErrors.js';
import {
  createBusinessSettingsSchema,
  updateBusinessSettingsSchema,
} from './validators/business-settings.schemas.js';

export class BusinessSettingsController {
  constructor(
    private readonly getSettings: GetBusinessSettings,
    private readonly createSettings: CreateBusinessSettings,
    private readonly updateSettings: UpdateBusinessSettings,
  ) {}

  get = (request: Request, response: Response, next: NextFunction): void => {
    this.getSettings
      .execute(request.user!.id)
      .then((settings) => response.json(settings))
      .catch((error: unknown) => this.handleError(response, error, next));
  };

  create = (request: Request, response: Response, next: NextFunction): void => {
    const parsed = createBusinessSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
      });
      return;
    }
    this.createSettings
      .execute(request.user!.id, parsed.data)
      .then((settings) => response.status(201).json(settings))
      .catch((error: unknown) => this.handleError(response, error, next));
  };

  update = (request: Request, response: Response, next: NextFunction): void => {
    const parsed = updateBusinessSettingsSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
      });
      return;
    }
    this.updateSettings
      .execute(request.user!.id, parsed.data)
      .then((settings) => response.json(settings))
      .catch((error: unknown) => this.handleError(response, error, next));
  };

  private handleError(response: Response, error: unknown, next: NextFunction): void {
    if (error instanceof BusinessSettingsError) {
      response.status(error.httpStatus).json({
        error: { code: error.code, message: error.message },
      });
      return;
    }
    next(error);
  }
}
