import type { AuthenticatedUser, AuthenticatedSession } from './auth';

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      session?: AuthenticatedSession;
    }
  }
}

export {};
