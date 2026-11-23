import type { Request, RequestHandler } from 'express';
import { cardTokenFingerprint } from '../../domain/loyaltyTokens.js';

type Bucket = { count: number; resetAt: number };

/**
 * Límite de peticiones en memoria (ventana fija), igual que el resto del backend, con la
 * respuesta de error del proyecto en español. Las llaves por token usan una huella del
 * token, nunca el token.
 */
export function loyaltyRateLimit(
  limit: number,
  windowMs: number,
  key: (request: Request) => string | null,
): RequestHandler {
  const buckets = new Map<string, Bucket>();
  return (request, response, next) => {
    const now = Date.now();
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    const bucketKey = key(request);
    if (!bucketKey) return next();
    const bucket = buckets.get(bucketKey);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
      return next();
    }
    bucket.count += 1;
    if (bucket.count > limit) {
      response.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
      response.setHeader('Cache-Control', 'no-store');
      response.status(429).json({
        error: {
          code: 'RATE_LIMITED',
          message: 'Demasiadas solicitudes. Intenta de nuevo en un momento.',
        },
      });
      return;
    }
    next();
  };
}

export const byIp = (request: Request) => `ip:${request.ip ?? 'unknown'}`;

export const byTokenParam = (request: Request) => {
  const token = request.params.token;
  return typeof token === 'string' && token ? `tok:${cardTokenFingerprint(token)}` : null;
};

export const byBodyToken = (request: Request) => {
  const token = (request.body as { cardToken?: unknown } | undefined)?.cardToken;
  return typeof token === 'string' && token ? `tok:${cardTokenFingerprint(token)}` : null;
};

/**
 * Por IP holgado (varios clientes pueden compartir IP pública con datos móviles) y por
 * token más estricto: frena intentos masivos de adivinar o abusar de un link.
 */
export const PUBLIC_LOYALTY_RATE_LIMITS = {
  cardByIp: { limit: 120, windowMs: 60_000 },
  cardByToken: { limit: 30, windowMs: 60_000 },
  programByIp: { limit: 240, windowMs: 60_000 },
  quoteByIp: { limit: 60, windowMs: 60_000 },
  quoteByToken: { limit: 20, windowMs: 60_000 },
} as const;
