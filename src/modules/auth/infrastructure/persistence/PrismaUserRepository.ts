import { PrismaClient } from '@prisma/client';
import { UserRepository } from '../../domain/ports/userRepository';
import { User } from '../../domain/entities/User';

export class PrismaUserRepository implements UserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByEmail(email: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({ where: { email } });
    return row ? this.toDomain(row) : null;
  }

  async findById(id: string): Promise<User | null> {
    const row = await this.prisma.user.findUnique({
      where: { id },
    });

    return row ? this.toDomain(row) : null;
  }

  private toDomain(row: {
    id: string;
    email: string;
    name: string;
    emailVerified: boolean;
    createdAt: Date;
    businessId?: string | null;
  }): User {
    return User.create({
      id: row.id,
      email: row.email,
      name: row.name,
      emailVerified: row.emailVerified,
      createdAt: row.createdAt,
      businessId: row.businessId,
    });
  }
}
