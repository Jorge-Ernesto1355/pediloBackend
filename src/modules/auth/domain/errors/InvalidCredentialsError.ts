import { AuthDomainError } from './AuthDomainError';

export class InvalidCredentialsError extends AuthDomainError {
  readonly httpStatus = 401;
  readonly code = 'INVALID_CREDENTIALS';

  constructor() {
    super('Email or password are wrong');
  }
}
