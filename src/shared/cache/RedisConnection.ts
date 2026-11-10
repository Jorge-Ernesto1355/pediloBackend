import { createClient, type RedisClientType } from 'redis';
import { env } from '@/shared/config/env.js';

const MAX_RECONNECT_ATTEMPTS = 8;

export type RedisClient = RedisClientType;

class RedisConnection {
  private readonly client: RedisClient | null;
  private connecting: Promise<void> | null = null;
  private reconnectAttempts = 0;

  constructor() {
    if (!env.REDIS_URL) {
      this.client = null;
      return;
    }

    this.client = createClient({
      url: env.REDIS_URL,
      socket: {
        connectTimeout: 1_000,
        reconnectStrategy: (retries) => {
          this.reconnectAttempts = retries;
          if (retries > MAX_RECONNECT_ATTEMPTS) return new Error('redis reconnect limit reached');
          const exponential = Math.min(1_000 * 2 ** (retries - 1), 30_000);
          return exponential + Math.floor(Math.random() * 500);
        },
      },
    });
    this.client.on('error', () => {
      // Never log the error object: redis errors may contain the configured URL.
    });
    this.client.on('ready', () => {
      this.reconnectAttempts = 0;
    });
  }

  isConfigured(): boolean {
    return this.client !== null;
  }

  async connect(): Promise<void> {
    if (!this.client || this.client.isOpen) return;
    if (!this.connecting) {
      this.connecting = this.client
        .connect()
        .then(() => undefined)
        .catch(() => undefined)
        .finally(() => {
          this.connecting = null;
        });
    }
    await this.connecting;
  }

  async close(): Promise<void> {
    if (!this.client || !this.client.isOpen) return;
    await this.client.quit().catch(() => undefined);
  }

  get(): RedisClient | null {
    return this.client?.isReady ? this.client : null;
  }
}

export const redisConnection = new RedisConnection();
