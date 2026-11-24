import { createHash } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
import { redisConnection } from './RedisConnection.js';

const KEY_PREFIX = 'pedilo:create-menu:v1';
const TTL_SECONDS = 15 * 60;
const COMMAND_TIMEOUT_MS = 250;

type CachedResponse = { status: number; body: unknown };

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), COMMAND_TIMEOUT_MS)),
  ]);
}

function resourceKey(path: string): string {
  return createHash('sha256').update(path).digest('hex').slice(0, 32);
}

export class CreateMenuResponseCache {
  async get(userId: string, path: string): Promise<CachedResponse | null> {
    const client = redisConnection.get();
    if (!client || !userId) return null;
    const version = await this.version(userId);
    const raw = await withTimeout(client.get(this.entryKey(userId, version, path)), null);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as CachedResponse;
    } catch {
      await withTimeout(client.del(this.entryKey(userId, version, path)), 0);
      return null;
    }
  }

  async set(userId: string, path: string, value: CachedResponse): Promise<void> {
    const client = redisConnection.get();
    if (!client || !userId) return;
    const version = await this.version(userId);
    await withTimeout(
      client.set(this.entryKey(userId, version, path), JSON.stringify(value), {
        EX: TTL_SECONDS,
      }),
      null,
    );
  }

  async invalidateUser(userId: string): Promise<void> {
    const client = redisConnection.get();
    if (!client || !userId) return;
    await withTimeout(client.incr(this.versionKey(userId)), 0);
  }

  private async version(userId: string): Promise<string> {
    const client = redisConnection.get();
    if (!client) return '0';
    return (await withTimeout(client.get(this.versionKey(userId)), null)) ?? '0';
  }

  private versionKey(userId: string): string {
    return `${KEY_PREFIX}:user:${userId}:version`;
  }

  private entryKey(userId: string, version: string, path: string): string {
    return `${KEY_PREFIX}:user:${userId}:v${version}:${resourceKey(path)}`;
  }
}

export const createMenuResponseCache = new CreateMenuResponseCache();

/** Redis read-through cache for authenticated create-menu GET responses. */
export const cacheCreateMenuResponse: RequestHandler = async (request, response, next) => {
  const userId = request.user?.id;
  if (!userId || request.method !== 'GET') return next();
  const path = request.originalUrl;
  const cached = await createMenuResponseCache.get(userId, path);
  if (cached) {
    response.setHeader('X-Pedilo-Cache', 'HIT');
    return response.status(cached.status).json(cached.body);
  }

  response.setHeader('X-Pedilo-Cache', 'MISS');
  const originalJson = response.json.bind(response);
  response.json = ((body: unknown) => {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      void createMenuResponseCache.set(userId, path, { status: response.statusCode, body });
    }
    return originalJson(body);
  }) as Response['json'];
  return next();
};
