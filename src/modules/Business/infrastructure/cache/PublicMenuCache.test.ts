import { describe, expect, it, vi } from 'vitest';
import { PublicMenuCache, type RedisCacheCommands } from './PublicMenuCache.js';

const catalog = {
  business: {
    id: 'business-1', name: 'Tacos', slug: 'tacos', description: null,
    logoUrl: null, logoBlurUrl: null, coverUrl: null, coverBlurUrl: null,
    whatsappNumber: null, paymentCardAvailable: false, ubication: null,
    ubicationMaps: null, businessSchedule: null,
  },
  menus: [],
};

function fakeRedis(): RedisCacheCommands {
  const values = new Map<string, string>();
  return {
    get: vi.fn(async (key: string) => values.get(key) ?? null),
    set: vi.fn(async (key: string, value: string, options?: { NX?: boolean; PX?: number; EX?: number }) => {
      if (options?.NX && values.has(key)) return null;
      values.set(key, value);
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const value = Number(values.get(key) ?? '0') + 1;
      values.set(key, String(value));
      return value;
    }),
    del: vi.fn(async (key: string) => Number(values.delete(key))),
    eval: vi.fn(async (_script: string, options: { keys: string[]; arguments: string[] }) => {
      const versionKey = options.keys[0]!;
      const entryKey = options.keys[1]!;
      const expected = options.arguments[0]!;
      const payload = options.arguments[1]!;
      if ((values.get(versionKey) ?? '0') === expected) values.set(entryKey, payload);
      return 'OK';
    }),
  };
}

describe('PublicMenuCache', () => {
  it('serves a cache hit without querying PostgreSQL again', async () => {
    const client = fakeRedis();
    const cache = new PublicMenuCache({ get: () => client });
    const loader = vi.fn().mockResolvedValue(catalog);

    await cache.getOrLoad(' Tacos ', loader);
    await cache.getOrLoad('tacos', loader);

    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('falls back to PostgreSQL when Redis is unavailable', async () => {
    const cache = new PublicMenuCache({ get: () => null });
    const loader = vi.fn().mockResolvedValue(catalog);

    await expect(cache.getOrLoad('tacos', loader)).resolves.toEqual(catalog);
    expect(loader).toHaveBeenCalledOnce();
  });

  it('coalesces concurrent misses in one backend instance', async () => {
    const client = fakeRedis();
    const cache = new PublicMenuCache({ get: () => client });
    let release!: (value: typeof catalog) => void;
    const loader = vi.fn().mockReturnValue(new Promise<typeof catalog>((resolve) => { release = resolve; }));

    const first = cache.getOrLoad('tacos', loader);
    const second = cache.getOrLoad('tacos', loader);
    release(catalog);

    await expect(Promise.all([first, second])).resolves.toEqual([catalog, catalog]);
    expect(loader).toHaveBeenCalledOnce();
  });
});
