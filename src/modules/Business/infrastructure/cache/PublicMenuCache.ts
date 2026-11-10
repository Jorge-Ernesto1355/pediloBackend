import { randomUUID } from 'node:crypto';
import type { PublicBusinessCatalog, PublicBusinessRepository } from '../../application/ports/PublicBusinessRepository.js';
import { redisConnection } from '@/shared/cache/RedisConnection.js';

export interface RedisCacheCommands {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { NX?: boolean; PX?: number; EX?: number }): Promise<string | null>;
  incr(key: string): Promise<number>;
  del(key: string): Promise<number>;
  eval(script: string, options: { keys: string[]; arguments: string[] }): Promise<unknown>;
}

export interface RedisCacheConnection {
  get(): RedisCacheCommands | null;
}

const TTL_SECONDS = 5 * 60;
const COMMAND_TIMEOUT_MS = 250;
const LOCK_TTL_MS = 2_000;
const KEY_PREFIX = 'pedilo:public-menu:v1';
const SET_IF_CURRENT_VERSION = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('SET', KEYS[2], ARGV[2], 'EX', ARGV[3])
  end
  return nil
`;
const RELEASE_LOCK = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

function normalizedSlug(slug: string): string {
  const value = slug.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._~-]{0,119}$/.test(value)) throw new Error('invalid public menu slug');
  return value;
}

function withTimeout<T>(promise: Promise<T>, fallback: T): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), COMMAND_TIMEOUT_MS)),
  ]);
}

export class PublicMenuCache {
  private readonly inFlight = new Map<string, Promise<PublicBusinessCatalog | null>>();

  constructor(private readonly connection: RedisCacheConnection = redisConnection) {}

  async getOrLoad(
    slug: string,
    loader: () => Promise<PublicBusinessCatalog | null>,
  ): Promise<PublicBusinessCatalog | null> {
    const safeSlug = normalizedSlug(slug);
    const existing = this.inFlight.get(safeSlug);
    if (existing) return existing;
    const operation = this.load(safeSlug, loader).finally(() => this.inFlight.delete(safeSlug));
    this.inFlight.set(safeSlug, operation);
    return operation;
  }

  async invalidateBusiness(businessId: string): Promise<void> {
    const client = this.connection.get();
    if (!client || !businessId) return;
    const indexKey = `${KEY_PREFIX}:business:${businessId}`;
    const slug = await withTimeout(client.get(indexKey), null);
    if (!slug) return;
    const versionKey = `${KEY_PREFIX}:version:${slug}`;
    await withTimeout(client.incr(versionKey), 0);
    await withTimeout(client.del(indexKey), 0);
    await withTimeout(client.del(this.entryKey(slug, await this.currentVersion(client, versionKey))), 0);
  }

  private async load(
    slug: string,
    loader: () => Promise<PublicBusinessCatalog | null>,
  ): Promise<PublicBusinessCatalog | null> {
    const client = this.connection.get();
    if (!client) return loader();
    const versionKey = `${KEY_PREFIX}:version:${slug}`;
    const version = await this.currentVersion(client, versionKey);
    const cached = await withTimeout(client.get(this.entryKey(slug, version)), null);
    if (cached) {
      const parsed = this.parse(cached);
      if (parsed) return parsed;
      await withTimeout(client.del(this.entryKey(slug, version)), 0);
    }

    const lockKey = `${KEY_PREFIX}:lock:${slug}`;
    const token = randomUUID();
    const lockAcquired = await withTimeout(client.set(lockKey, token, { NX: true, PX: LOCK_TTL_MS }), null);
    if (!lockAcquired) {
      for (let attempt = 0; attempt < 10; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 40 + attempt * 10));
        const retry = await withTimeout(client.get(this.entryKey(slug, await this.currentVersion(client, versionKey))), null);
        if (retry) {
          const parsed = this.parse(retry);
          if (parsed) return parsed;
        }
      }
    }

    try {
      const catalog = await loader();
      if (!catalog) return null;
      const payload = JSON.stringify(catalog);
      await withTimeout(
        client.eval(SET_IF_CURRENT_VERSION, {
          keys: [versionKey, this.entryKey(slug, version)],
          arguments: [version, payload, String(TTL_SECONDS)],
        }),
        null,
      );
      await withTimeout(client.set(`${KEY_PREFIX}:business:${catalog.business.id}`, slug, { EX: TTL_SECONDS }), null);
      return catalog;
    } finally {
      if (lockAcquired) {
        await withTimeout(client.eval(RELEASE_LOCK, { keys: [lockKey], arguments: [token] }), 0);
      }
    }
  }

  private async currentVersion(client: RedisCacheCommands, key: string): Promise<string> {
    return (await withTimeout(client.get(key), null)) ?? '0';
  }

  private entryKey(slug: string, version: string): string {
    return `${KEY_PREFIX}:entry:${slug}:${version}`;
  }

  private parse(value: string): PublicBusinessCatalog | null {
    try {
      return JSON.parse(value) as PublicBusinessCatalog;
    } catch {
      return null;
    }
  }
}

export const publicMenuCache = new PublicMenuCache();

export class CachedPublicBusinessRepository implements PublicBusinessRepository {
  constructor(private readonly source: PublicBusinessRepository) {}

  getCatalogBySlug(slug: string): Promise<PublicBusinessCatalog | null> {
    return publicMenuCache.getOrLoad(slug, () => this.source.getCatalogBySlug(slug));
  }

  getActiveDiscountsBySlug(slug: string) {
    return this.source.getActiveDiscountsBySlug(slug);
  }
}
