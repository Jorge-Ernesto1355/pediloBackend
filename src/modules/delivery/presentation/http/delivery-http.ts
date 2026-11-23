import type { NextFunction, Response } from 'express';
import { AppError } from '@/shared/errors/app-error.js';

export function sendValidationError(response: Response, error: { flatten(): unknown }): void {
  response.status(400).json({
    error: {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: error.flatten(),
    },
  });
}

/** Errores de dominio con su estado HTTP y `details`; lo demás va al manejador global. */
export function sendDeliveryError(response: Response, error: unknown, next: NextFunction): void {
  if (!(error instanceof AppError)) return next(error);
  const details = 'details' in error ? (error as { details?: unknown }).details : undefined;
  response.status(error.statusCode).json({
    error: { code: error.code, message: error.message, ...(details ? { details } : {}) },
  });
}
