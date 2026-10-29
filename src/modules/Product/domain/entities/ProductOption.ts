import {
  InvalidOptionPriceError,
  InvalidOptionSelectionConfigurationError,
} from '../errors/ProductOptionErrors.js';

export interface OptionSelectionConfiguration {
  minSelections: number;
  maxSelections: number;
}

export function assertOptionSelectionConfiguration(
  configuration: OptionSelectionConfiguration,
): void {
  const { minSelections, maxSelections } = configuration;
  if (
    !Number.isInteger(minSelections) ||
    !Number.isInteger(maxSelections) ||
    minSelections < 0 ||
    maxSelections < minSelections
  ) {
    throw new InvalidOptionSelectionConfigurationError();
  }
}

export function assertOptionPrice(price: number): void {
  if (
    !Number.isFinite(price) ||
    price < 0 ||
    Math.abs(price * 100 - Math.round(price * 100)) >= 1e-8
  ) {
    throw new InvalidOptionPriceError();
  }
}
