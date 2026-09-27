import { AuthDomainError } from './AuthDomainError.js';

export class AccountNameAlreadyInUseError extends AuthDomainError {
  readonly httpStatus = 409;
  readonly code = 'NAME_ALREADY_IN_USE';

  constructor() {
    super('This name is already in use');
  }
}

export class CurrentPasswordIncorrectError extends AuthDomainError {
  readonly httpStatus = 400;
  readonly code = 'CURRENT_PASSWORD_INCORRECT';

  constructor() {
    super('Current password is incorrect');
  }
}

export class PasswordRequirementsError extends AuthDomainError {
  readonly httpStatus = 400;
  readonly code = 'PASSWORD_REQUIREMENTS_NOT_MET';

  constructor() {
    super('Password does not meet the security requirements');
  }
}
