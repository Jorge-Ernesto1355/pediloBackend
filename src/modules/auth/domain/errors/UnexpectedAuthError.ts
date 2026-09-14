import { AuthDomainError } from './AuthDomainError';

export class UnexpectedAuthError extends AuthDomainError {
  readonly httpStatus = 500;
  readonly code = 'UNEXPECTED_AUTH_ERROR';

  constructor(message: string) {
    super(message);
  }
}
