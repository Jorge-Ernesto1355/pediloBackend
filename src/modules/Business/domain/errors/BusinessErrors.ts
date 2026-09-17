export abstract class BusinessError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BusinessNotFoundError extends BusinessError {
  readonly httpStatus = 404;
  readonly code = 'BUSINESS_NOT_FOUND';

  constructor() {
    super('Business not found');
  }
}

export class BusinessAlreadyExistsError extends BusinessError {
  readonly httpStatus = 409;
  readonly code = 'BUSINESS_SLUG_ALREADY_EXISTS';

  constructor() {
    super('A business with this slug already exists');
  }
}

export class UserAlreadyHasBusinessError extends BusinessError {
  readonly httpStatus = 409;
  readonly code = 'USER_ALREADY_HAS_BUSINESS';

  constructor() {
    super('The user already belongs to a business');
  }
}

export class BusinessAccessDeniedError extends BusinessError {
  readonly httpStatus = 403;
  readonly code = 'BUSINESS_ACCESS_DENIED';

  constructor() {
    super('You do not have access to this business');
  }
}
