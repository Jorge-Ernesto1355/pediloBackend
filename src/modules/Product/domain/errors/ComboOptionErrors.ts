export abstract class ComboOptionError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ComboProductNotFoundError extends ComboOptionError {
  readonly httpStatus = 404;
  readonly code = 'COMBO_PRODUCT_NOT_FOUND';
  constructor() {
    super('Combo product not found');
  }
}

export class ComboOptionGroupNotFoundError extends ComboOptionError {
  readonly httpStatus = 404;
  readonly code = 'COMBO_OPTION_GROUP_NOT_FOUND';
  constructor() {
    super('Combo option group not found');
  }
}

export class ComboChoiceProductNotFoundError extends ComboOptionError {
  readonly httpStatus = 400;
  readonly code = 'COMBO_CHOICE_PRODUCT_NOT_FOUND';
  constructor() {
    super('Choice product must belong to the same business as the combo');
  }
}

export class InvalidComboSelectionConfigurationError extends ComboOptionError {
  readonly httpStatus = 400;
  readonly code = 'INVALID_COMBO_SELECTION_CONFIGURATION';
  constructor() {
    super('Selection limits must be valid and cannot exceed the available product choices');
  }
}

export class DuplicateComboChoiceProductError extends ComboOptionError {
  readonly httpStatus = 409;
  readonly code = 'DUPLICATE_COMBO_CHOICE_PRODUCT';
  constructor() {
    super('Product is already available in this option group');
  }
}

export class ComboChoiceProductNotInGroupError extends ComboOptionError {
  readonly httpStatus = 404;
  readonly code = 'COMBO_CHOICE_PRODUCT_NOT_IN_GROUP';
  constructor() {
    super('Choice product is not part of this option group');
  }
}
