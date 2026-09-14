import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { User } from '@/modules/auth/domain/entities/User.js';
import type { AuthSessionReader } from '@/modules/auth/domain/ports/AuthProvider.js';

export class AuthMiddleware {
  constructor(private readonly sessionReader: AuthSessionReader) {}

  /** Requires a valid session and exposes the user through `req.user`. */
  readonly requireAuth: RequestHandler = async (
    request: Request,
    response: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const user = await this.sessionReader.getSession(toHeaders(request));

      if (!user) {
        response.status(401).json({
          error: {
            code: 'NOT_AUTHENTICATED',
            message: 'User is not authenticated',
          },
        });
        return;
      }

      request.user = toAuthenticatedUser(user);
      next();
    } catch (error) {
      next(error);
    }
  };
}

/** Creates the reusable middleware with its provider injected. */
export function createRequireAuth(sessionReader: AuthSessionReader): RequestHandler {
  return new AuthMiddleware(sessionReader).requireAuth;
}

function toHeaders(request: Request): Headers {
  const headers = new Headers();

  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === 'string') headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(', '));
  }

  return headers;
}

function toAuthenticatedUser(user: User) {
  return {
    id: user.getId(),
    name: user.getName(),
    email: user.getEmail(),
  };
}
