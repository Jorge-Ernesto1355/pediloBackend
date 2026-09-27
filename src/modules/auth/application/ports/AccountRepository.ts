export interface AccountProfile {
  name: string;
  email: string;
  emailVerified: boolean;
  createdAt: Date;
  stats: {
    customersCount: number;
    totalGenerated: number;
    ordersCount: number;
  };
}

export interface AccountRepository {
  getProfile(userId: string): Promise<AccountProfile | null>;
  hasNameConflict(userId: string, name: string): Promise<boolean>;
  updateName(userId: string, name: string): Promise<void>;
  getEmailVerificationTarget(userId: string): Promise<{
    email: string;
    emailVerified: boolean;
  } | null>;
  markEmailVerified(
    tokenHash: string,
    now: Date,
  ): Promise<'verified' | 'already-verified' | 'invalid'>;
}
