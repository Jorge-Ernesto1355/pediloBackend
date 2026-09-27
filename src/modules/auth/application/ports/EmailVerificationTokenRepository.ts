export interface EmailVerificationTokenRepository {
  cleanup(): Promise<void>;
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
}
