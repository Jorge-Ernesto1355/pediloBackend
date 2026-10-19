export interface AnonymousStoreVisitorHasher {
  hash(ipAddress: string, userAgent: string): string;
}
