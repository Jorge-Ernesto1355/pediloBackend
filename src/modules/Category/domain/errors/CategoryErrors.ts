export abstract class CategoryError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class CategoryBusinessAccessDeniedError extends CategoryError {
  readonly httpStatus = 403;
  readonly code = 'CATEGORY_BUSINESS_ACCESS_DENIED';

  constructor() {
    super('You do not have access to this business');
  }
}

export class CategoryBusinessNotFoundError extends CategoryError {
  readonly httpStatus = 404;
  readonly code = 'CATEGORY_BUSINESS_NOT_FOUND';

  constructor() {
    super('Business not found');
  }
}

export class CategoryMenuNotFoundError extends CategoryError {
  readonly httpStatus = 404;
  readonly code = 'CATEGORY_MENU_NOT_FOUND';

  constructor() {
    super('Menu not found for this business');
  }
}

export class CategoryNotFoundError extends CategoryError {
  readonly httpStatus = 404;
  readonly code = 'CATEGORY_NOT_FOUND';

  constructor() {
    super('Category not found');
  }
}

export class CategoryContainsProductsError extends CategoryError {
  readonly httpStatus = 409;
  readonly code = 'CATEGORY_CONTAINS_PRODUCTS';

  constructor() {
    super('Category cannot be deleted while it contains products');
  }
}

export class InvalidCategoryOrderError extends CategoryError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_CATEGORY_ORDER';

  constructor() {
    super('The category order must contain every category in the menu exactly once');
  }
}

export class SameCategoryError extends CategoryError {
  readonly httpStatus = 400;
  readonly code = 'SAME_CATEGORY';

  constructor() {
    super('Source and target categories must be different');
  }
}
