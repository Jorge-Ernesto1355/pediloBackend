import { Request, Response } from 'express';
import { GetCurrentUser } from '../../application/use-cases/getCurrentUser';
import { LoginUser } from '../../application/use-cases/LoginUser';
import { RegisterUser } from '../../application/use-cases/RegisterUser';
import { AuthProvider, AuthSessionResult } from '../../domain/ports/AuthProvider';
import { loginSchema, registerSchema } from './validators/auth.schemas';
import { fromNodeHeaders } from 'better-auth/node';
import { AuthDomainError } from '../../domain/errors/AuthDomainError';

export class AuthController {
  constructor(
    private readonly registerUser: RegisterUser,
    private readonly loginUser: LoginUser,
    private readonly getCurrentUser: GetCurrentUser,
    private readonly authProvider: AuthProvider,
  ) {}

  register = async (req: Request, res: Response) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
      const result = await this.registerUser.execute(parsed.data);

      this.attachCookies(res, result);
      return res.status(201).json({ user: result.user.toJSON() });
    } catch (error) {
      return this.handleError(res, error);
    }
  };

  login = async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    try {
      const result = await this.loginUser.execute(parsed.data);
      this.attachCookies(res, result);
      return res.status(200).json({ user: result.user.toJSON() });
    } catch (error) {
      return this.handleError(res, error);
    }
  };

  me = async (req: Request, res: Response) => {
    const headers = fromNodeHeaders(req.headers);
    const user = await this.getCurrentUser.execute(headers);

    if (!user)
      return res
        .status(401)
        .json({ error: { code: 'NOT_AUTHENTICATED', message: 'User is not authenticated' } });
    return res.status(200).json({ user: user.toJSON() });
  };

  logout = async (req: Request, res: Response) => {
    const headers = fromNodeHeaders(req.headers);
    await this.authProvider.signOut(headers);
    return res.status(204).send();
  };

  private attachCookies(res: Response, result: AuthSessionResult) {
    for (const cookie of result.setCookie) res.append('Set-Cookie', cookie);
  }

  private handleError(res: Response, error: unknown) {
    if (error instanceof AuthDomainError) {
      return res
        .status(error.httpStatus)
        .json({ error: { code: error.code, message: error.message } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected error' } });
  }
}
