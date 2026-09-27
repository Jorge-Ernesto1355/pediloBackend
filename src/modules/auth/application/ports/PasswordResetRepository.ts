export interface PasswordResetRepository {
  cleanup(): Promise<void>;
  hasCredential(userId: string): Promise<boolean>;
  create(input: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  resetPassword(input: { tokenHash: string; passwordHash: string; now: Date }): Promise<boolean>;
}
