export abstract class ProductOptionError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class OptionProductNotFoundError extends ProductOptionError {
  readonly httpStatus = 404;
  readonly code = 'OPTION_GROUP_PRODUCT_NOT_FOUND';
  constructor() {
    super('Product not found');
  }
}

export class OptionBusinessAccessDeniedError extends ProductOptionError {
  readonly httpStatus = 403;
  readonly code = 'OPTION_GROUP_BUSINESS_ACCESS_DENIED';
  constructor() {
    super('You do not have access to this business');
  }
}

export class OptionGroupNotFoundError extends ProductOptionError {
  readonly httpStatus = 404;
  readonly code = 'OPTION_GROUP_NOT_FOUND';
  constructor() {
    super('Option group not found');
  }
}

export class OptionNotFoundError extends ProductOptionError {
  readonly httpStatus = 404;
  readonly code = 'OPTION_NOT_FOUND';
  constructor() {
    super('Option not found');
  }
}

export class InvalidOptionGroupConfigurationError extends ProductOptionError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_OPTION_GROUP_CONFIGURATION';
  constructor() {
    super('Option group selection configuration is invalid');
  }
}

export class InvalidOptionGroupOrderError extends ProductOptionError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_OPTION_GROUP_ORDER';
  constructor() {
    super('The option group order is invalid');
  }
}

export class InvalidOptionOrderError extends ProductOptionError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_OPTION_ORDER';
  constructor() {
    super('The option order is invalid');
  }
}

export class InvalidOptionPriceError extends ProductOptionError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_OPTION_PRICE';
  constructor() {
    super('Option price is invalid');
  }
}

export class SameOptionGroupError extends ProductOptionError {
  readonly httpStatus = 400;
  readonly code = 'OPTION_GROUP_SAME_PRODUCT';
  constructor() {
    super('Option group already belongs to this product');
  }
}
