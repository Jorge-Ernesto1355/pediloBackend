export abstract class MenuError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class MenuBusinessNotFoundError extends MenuError {
  readonly httpStatus = 404;
  readonly code = 'BUSINESS_NOT_FOUND';

  constructor() {
    super('Business not found');
  }
}

export class MenuAccessDeniedError extends MenuError {
  readonly httpStatus = 403;
  readonly code = 'BUSINESS_ACCESS_DENIED';

  constructor() {
    super('You do not have access to this business');
  }
}

export class MenuNotFoundError extends MenuError {
  readonly httpStatus = 404;
  readonly code = 'MENU_NOT_FOUND';

  constructor() {
    super('Menu not found');
  }
}

export class MenuContainsProductsError extends MenuError {
  readonly httpStatus = 409;
  readonly code = 'MENU_CONTAINS_PRODUCTS';

  constructor() {
    super('Menu cannot be deleted while it contains products');
  }
}
