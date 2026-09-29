import { AppError } from '@/shared/errors/app-error.js';

export class OrderBusinessNotFoundError extends AppError {
  constructor() {
    super('Business not found', 404, 'BUSINESS_NOT_FOUND');
  }
}
export class OrderBusinessAccessError extends AppError {
  constructor() {
    super('You do not have access to this business', 403, 'ORDER_BUSINESS_ACCESS_DENIED');
  }
}
export class OrderNotFoundError extends AppError {
  constructor() {
    super('Order not found', 404, 'ORDER_NOT_FOUND');
  }
}
export class OrderProductNotFoundError extends AppError {
  constructor(_productId: string) {
    super('Product is not available for this business', 400, 'ORDER_PRODUCT_NOT_AVAILABLE');
  }
}
export class OrderInvalidOptionsError extends AppError {
  constructor(_productId: string) {
    super('Selected product options are invalid', 400, 'ORDER_INVALID_OPTIONS');
  }
}
export class OrderInvalidStatusTransitionError extends AppError {
  constructor(from: string, to: string) {
    super(`Order cannot change from ${from} to ${to}`, 409, 'ORDER_INVALID_STATUS_TRANSITION');
  }
}
