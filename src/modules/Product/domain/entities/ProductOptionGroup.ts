import { InvalidOptionGroupConfigurationError } from '../errors/ProductOptionErrors.js';

export interface OptionGroupConfiguration {
  isRequired: boolean;
  minSelections: number;
  maxSelections: number;
}

export function assertOptionGroupConfiguration(configuration: OptionGroupConfiguration): void {
  const { isRequired, minSelections, maxSelections } = configuration;
  if (
    !Number.isInteger(minSelections) ||
    !Number.isInteger(maxSelections) ||
    minSelections < 0 ||
    maxSelections < minSelections ||
    (isRequired && minSelections < 1)
  ) {
    throw new InvalidOptionGroupConfigurationError();
  }
}
