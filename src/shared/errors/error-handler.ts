import type { ErrorRequestHandler } from 'express';
import { AppError } from './app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const publicError = toPublicError(error);

  response.status(publicError.statusCode).json({ error: publicError });
};

function toPublicError(error: unknown): { statusCode: number; code: string; message: string } {
  if (error instanceof AppError) {
    return { statusCode: error.statusCode, code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    const candidate = error as Error & { statusCode?: unknown; code?: unknown };
    if (candidate.code === 'P2021' || candidate.code === 'P2022') {
      return {
        statusCode: 503,
        code: 'DISCOUNT_STORAGE_UNAVAILABLE',
        message: 'Los descuentos no están disponibles temporalmente. Inténtalo nuevamente en unos momentos.',
      };
    }
    if (
      typeof candidate.statusCode === 'number' &&
      typeof candidate.code === 'string' &&
      candidate.statusCode >= 400 &&
      candidate.statusCode < 500
    ) {
      return {
        statusCode: candidate.statusCode,
        code: candidate.code,
        message: error.message,
      };
    }
  }

  return { statusCode: 500, code: 'INTERNAL_ERROR', message: 'Internal server error' };
}
