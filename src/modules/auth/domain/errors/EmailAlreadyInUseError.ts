import { AuthDomainError } from './AuthDomainError';

export class EmailAlreadyExistsError extends AuthDomainError {
  readonly httpStatus = 409;
  readonly code = 'EMAIL_ALREADY_IN_USE';

  constructor(email: string) {
    super(`The email ${email} is already in use`);
    this.name = this.constructor.name;
  }
}
