import { AppError } from '@/shared/errors/app-error.js';

export class CustomerNotFoundError extends AppError {
  constructor() {
    super('Customer not found', 404, 'CUSTOMER_NOT_FOUND');
  }
}
export class CustomerBusinessAccessError extends AppError {
  constructor() {
    super('You do not have access to this business', 403, 'CUSTOMER_BUSINESS_ACCESS_DENIED');
  }
}
export class CustomerBusinessNotFoundError extends AppError {
  constructor() {
    super('Business not found', 404, 'BUSINESS_NOT_FOUND');
  }
}
export class CustomerHasOrdersError extends AppError {
  constructor() {
    super('Customer cannot be deleted because it has orders', 409, 'CUSTOMER_HAS_ORDERS');
  }
}
export class CustomerPhoneAlreadyExistsError extends AppError {
  constructor() {
    super(
      'A customer with this phone number already exists in this business',
      409,
      'CUSTOMER_PHONE_ALREADY_EXISTS',
    );
  }
}
