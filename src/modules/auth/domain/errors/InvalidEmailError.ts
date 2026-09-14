import { AuthDomainError } from './AuthDomainError';

export class InvalidEmailError extends AuthDomainError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_EMAIL';

  constructor(email: string) {
    super(`The email ${email} is invalid`);
  }
}
