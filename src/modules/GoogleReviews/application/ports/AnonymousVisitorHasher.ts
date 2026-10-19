export interface AnonymousVisitorHasher {
  hash(ipAddress: string, userAgent: string): string;
}
