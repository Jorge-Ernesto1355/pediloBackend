export abstract class AuthDomainError extends Error {
  abstract readonly httpStatus: number;
  abstract readonly code: string;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}
