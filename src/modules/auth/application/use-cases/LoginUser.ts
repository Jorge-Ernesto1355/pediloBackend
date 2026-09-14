import { AuthProvider, AuthSessionResult } from '../../domain/ports/AuthProvider';
import { Email } from '../../domain/value-objects/Email';
import { LoginDTO } from '../dto/LoginDTO';

export class LoginUser {
  constructor(private readonly authProvider: AuthProvider) {}

  async execute(dto: LoginDTO): Promise<AuthSessionResult> {
    const email = Email.create(dto.email);

    return this.authProvider.signIn({
      email: email.toString(),
      password: dto.password,
    });
  }
}
