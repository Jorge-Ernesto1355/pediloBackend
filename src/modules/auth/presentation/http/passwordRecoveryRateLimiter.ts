import type { RequestHandler } from 'express';

type Bucket = { count: number; resetAt: number };

export class PasswordRecoveryRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  middleware(
    limit: number,
    windowMs: number,
    key: (request: Parameters<RequestHandler>[0]) => string,
  ): RequestHandler {
    return (request, response, next) => {
      const now = Date.now();
      for (const [bucketKey, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(bucketKey);
      }

      const bucketKey = key(request);
      const bucket = this.buckets.get(bucketKey);
      if (!bucket || bucket.resetAt <= now) {
        this.buckets.set(bucketKey, { count: 1, resetAt: now + windowMs });
        return next();
      }

      bucket.count += 1;
      if (bucket.count > limit) {
        response.setHeader('Retry-After', Math.ceil((bucket.resetAt - now) / 1000));
        return response.status(429).json({
          success: false,
          message: 'Too many requests. Please try again later.',
        });
      }
      return next();
    };
  }
}
