import { InvalidEmailError } from '../errors/InvalidEmailError';

const EmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class Email {
  private constructor(private readonly value: string) {}

  public static create(value: string): Email {
    if (!EmailRegex.test(value)) {
      throw new InvalidEmailError(value);
    }
    return new Email(value);
  }

  toString() {
    return this.value;
  }
}
