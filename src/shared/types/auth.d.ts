export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
}

export interface AuthenticatedSession {
  id: string;
  userId: string;
  expiresAt: Date;
}
