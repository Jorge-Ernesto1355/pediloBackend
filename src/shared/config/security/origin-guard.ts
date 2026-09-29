import type { RequestHandler } from 'express';
import { trustedOrigins } from '../env.js';

const stateChangingMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Rejects browser state-changing requests from origins outside the configured allow-list. */
export const trustedOriginGuard: RequestHandler = (request, response, next) => {
  const origin = request.get('origin');
  if (!origin || !stateChangingMethods.has(request.method)) return next();

  const normalizedOrigin = origin.trim().replace(/\/$/, '');
  if (trustedOrigins.includes(normalizedOrigin)) return next();

  return response.status(403).json({
    error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Request origin is not allowed' },
  });
};
