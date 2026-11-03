import { AppError } from '@/shared/errors/app-error.js';

export class CustomerDiscountOrderNotFoundError extends AppError {
  constructor() {
    super('Order not found', 404, 'ORDER_NOT_FOUND');
  }
}

export class CustomerDiscountCustomerRequiredError extends AppError {
  constructor() {
    super('This order is not linked to a customer with a phone number', 400, 'CUSTOMER_REQUIRED');
  }
}

export class CustomerDiscountAlreadyActiveError extends AppError {
  constructor() {
    super('This customer already has an available discount for this business', 409, 'CUSTOMER_DISCOUNT_ALREADY_ACTIVE');
  }
}

export class CustomerDiscountInvalidValueError extends AppError {
  constructor() {
    super('Discount value is outside the allowed range', 400, 'CUSTOMER_DISCOUNT_INVALID_VALUE');
  }
}

export class CustomerDiscountCustomerNotFoundError extends AppError {
  constructor() { super('Customer not found', 404, 'CUSTOMER_NOT_FOUND'); }
}
export class CustomerDiscountNotFoundError extends AppError {
  constructor() { super('Customer discount not found', 404, 'CUSTOMER_DISCOUNT_NOT_FOUND'); }
}
export class CustomerDiscountAlreadyUsedError extends AppError {
  constructor() { super('A used discount cannot be revoked', 409, 'CUSTOMER_DISCOUNT_ALREADY_USED'); }
}
export class CustomerDiscountApplicationFailedError extends AppError {
  constructor() { super('The discount could not be applied to this order', 409, 'CUSTOMER_DISCOUNT_APPLICATION_FAILED'); }
}
