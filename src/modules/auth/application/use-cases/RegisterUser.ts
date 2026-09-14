import { AuthProvider, AuthSessionResult } from '../../domain/ports/AuthProvider';
import { Email } from '../../domain/value-objects/Email';
import { RegisterDTO } from '../dto/RegisterDTO';

export class RegisterUser {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(dto: RegisterDTO): Promise<AuthSessionResult> {
    const email = Email.create(dto.email);
    return this.authProvider.signUp({
      email: email.toString(),
      password: dto.password,
      name: dto.name,
    });
  }
}
