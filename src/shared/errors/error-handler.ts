import type { ErrorRequestHandler } from 'express';
import { AppError } from './app-error.js';

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => {
  const statusCode = error instanceof AppError ? error.statusCode : 500;
  const message = error instanceof Error ? error.message : 'Internal server error';

  response.status(statusCode).json({
    error: {
      message,
    },
  });
};
