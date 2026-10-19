import { createHmac } from 'node:crypto';
import type { AnonymousStoreVisitorHasher } from '../../application/ports/AnonymousStoreVisitorHasher.js';

export class HmacAnonymousStoreVisitorHasher implements AnonymousStoreVisitorHasher {
  constructor(private readonly secret: string) {}

  hash(ipAddress: string, _userAgent: string): string {
    return createHmac('sha256', this.secret)
      .update(normalizeIp(ipAddress))
      .digest('hex');
  }
}

function normalizeIp(value: string): string {
  const ip = value.trim().toLowerCase();
  return ip.startsWith('::ffff:') ? ip.slice(7) : ip;
}
