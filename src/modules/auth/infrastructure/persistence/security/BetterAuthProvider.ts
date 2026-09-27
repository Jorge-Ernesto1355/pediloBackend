import {
  AuthProvider,
  AuthSessionResult,
  SignInInput,
  SignUpInput,
} from '@/modules/auth/domain/ports/AuthProvider';
import type { auth as AuthClient } from '@/libs/auth';
import { User } from '@/modules/auth/domain/entities/User';
import { APIError } from 'better-auth';
import { EmailAlreadyExistsError } from '../../../domain/errors/EmailAlreadyInUseError';
import { InvalidCredentialsError } from '@/modules/auth/domain/errors/InvalidCredentialsError';
import { UnexpectedAuthError } from '@/modules/auth/domain/errors/UnexpectedAuthError';
import {
  CurrentPasswordIncorrectError,
  PasswordRequirementsError,
} from '@/modules/auth/domain/errors/AccountErrors.js';

type BetterAuthUser = {
  id: string;
  email: string;
  name: string;
  emailVerified: boolean;
  createdAt: string | Date;
};

export class BetterAuthProvider implements AuthProvider {
  constructor(private readonly auth: typeof AuthClient) {}
  async signUp(input: SignUpInput): Promise<AuthSessionResult> {
    try {
      const response = await this.auth.api.signUpEmail({
        body: input,
        asResponse: true,
      });

      if (!response.ok) {
        const body = await response.json();

        throw new APIError('BAD_REQUEST', body.code, body.message);
      }

      return this.toSessionResult(response);
    } catch (error) {
      throw this.mapError(error, input.email);
    }
  }

  async signIn(input: SignInInput): Promise<AuthSessionResult> {
    try {
      const response = await this.auth.api.signInEmail({
        body: input,
        asResponse: true,
      });

      if (!response.ok) {
        const body = await response.clone().json();

        throw new APIError(
          'UNAUTHORIZED',
          body.code ?? 'INVALID_EMAIL_OR_PASSWORD',
          body.message ?? 'Invalid credentials',
        );
      }

      return this.toSessionResult(response);
    } catch (error) {
      throw this.mapError(error, input.email);
    }
  }

  async getSession(headers: Headers): Promise<User | null> {
    const session = await this.auth.api.getSession({ headers });
    if (!session) return null;
    return this.toDomainUser(session.user as BetterAuthUser);
  }

  async signOut(headers: Headers): Promise<void> {
    await this.auth.api.signOut({ headers });
  }

  async changePassword(
    headers: Headers,
    currentPassword: string,
    newPassword: string,
  ): Promise<string[]> {
    try {
      const response = await this.auth.api.changePassword({
        body: { currentPassword, newPassword, revokeOtherSessions: true },
        headers,
        asResponse: true,
      });
      if (!response.ok) {
        const body = (await response.clone().json()) as { code?: string; message?: string };
        if (body.code === 'INVALID_PASSWORD') throw new CurrentPasswordIncorrectError();
        if (body.code === 'PASSWORD_TOO_SHORT' || body.code === 'PASSWORD_TOO_LONG') {
          throw new PasswordRequirementsError();
        }
        throw new UnexpectedAuthError(body.message ?? 'Password change failed');
      }
      return typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter((value): value is string => Boolean(value));
    } catch (error) {
      if (error instanceof APIError) {
        const code =
          typeof error.body === 'string'
            ? error.body
            : (error.body as { code?: string } | undefined)?.code;
        if (code === 'INVALID_PASSWORD') throw new CurrentPasswordIncorrectError();
        if (code === 'PASSWORD_TOO_SHORT' || code === 'PASSWORD_TOO_LONG') {
          throw new PasswordRequirementsError();
        }
      }
      throw error;
    }
  }

  private async toSessionResult(response: Response): Promise<AuthSessionResult> {
    const body = (await response.json()) as { user: BetterAuthUser };

    const setCookie =
      typeof response.headers.getSetCookie === 'function'
        ? response.headers.getSetCookie()
        : [response.headers.get('set-cookie')].filter((v): v is string => Boolean(v));
    return { user: this.toDomainUser(body.user), setCookie };
  }

  private toDomainUser(raw: BetterAuthUser): User {
    return User.create({
      id: raw.id,
      email: raw.email,
      name: raw.name,
      emailVerified: raw.emailVerified,
      createdAt: new Date(raw.createdAt),
    });
  }
  private mapError(error: unknown, email: string): Error {
    if (error instanceof APIError) {
      const code =
        typeof error.body === 'string'
          ? error.body
          : (error.body as { code?: string } | undefined)?.code;

      if (code === 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL') {
        return new EmailAlreadyExistsError(email);
      }

      if (code === 'INVALID_EMAIL_OR_PASSWORD') {
        return new InvalidCredentialsError();
      }

      return new UnexpectedAuthError('An unexpected error occurred during authentication');
    }

    return new UnexpectedAuthError(
      error instanceof Error ? error.message : 'An unexpected error occurred during authentication',
    );
  }
}
