import { InvalidOptionPriceError } from '../errors/ProductOptionErrors.js';

export function assertOptionPrice(price: number): void {
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    Math.abs(price * 100 - Math.round(price * 100)) >= 1e-8
  ) {
    throw new InvalidOptionPriceError();
  }
}
