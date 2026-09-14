import { User } from '../../domain/entities/User';
import { AuthProvider } from '../../domain/ports/AuthProvider';
import { UserRepository } from '../../domain/ports/userRepository';

export class GetCurrentUser {
  constructor(
    private readonly authProvider: AuthProvider,
    private readonly userRepository: UserRepository,
  ) {}

  async execute(headers: Headers): Promise<User | null> {
    const sessionUser = await this.authProvider.getSession(headers);
    if (!sessionUser) return null;

    return this.userRepository.findById(sessionUser.getId());
  }
}
