export abstract class ProductError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ProductBusinessNotFoundError extends ProductError {
  readonly httpStatus = 404;
  readonly code = 'BUSINESS_NOT_FOUND';
  constructor() {
    super('Business not found');
  }
}

export class ProductAccessDeniedError extends ProductError {
  readonly httpStatus = 403;
  readonly code = 'BUSINESS_ACCESS_DENIED';
  constructor() {
    super('You do not have access to this business');
  }
}

export class ProductNotFoundError extends ProductError {
  readonly httpStatus = 404;
  readonly code = 'PRODUCT_NOT_FOUND';
  constructor() {
    super('Product not found');
  }
}

export class ProductHasOrdersError extends ProductError {
  readonly httpStatus = 409;
  readonly code = 'PRODUCT_HAS_ORDERS';
  constructor() {
    super('Product cannot be deleted because it has order history');
  }
}

export class ProductTargetCategoryNotFoundError extends ProductError {
  readonly httpStatus = 404;
  readonly code = 'TARGET_CATEGORY_NOT_FOUND';
  constructor() {
    super('Target category not found for this business');
  }
}

export class InvalidProductDataError extends ProductError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_PRODUCT_DATA';
  constructor() {
    super('Product data is invalid');
  }
}

export class ProductSameCategoryError extends ProductError {
  readonly httpStatus = 400;
  readonly code = 'PRODUCT_SAME_CATEGORY';
  constructor() {
    super('Product is already in the target category');
  }
}

export class InvalidProductOrderError extends ProductError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_PRODUCT_ORDER';
  constructor() {
    super('The product order must contain every product in the category exactly once');
  }
}
