export abstract class BusinessSettingsError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class BusinessSettingsBusinessNotFoundError extends BusinessSettingsError {
  readonly httpStatus = 404;
  readonly code = 'BUSINESS_NOT_FOUND';

  constructor() {
    super('Business not found');
  }
}

export class BusinessSettingsAlreadyExistsError extends BusinessSettingsError {
  readonly httpStatus = 409;
  readonly code = 'SETTINGS_ALREADY_EXISTS';

  constructor() {
    super('Business settings already exist');
  }
}
