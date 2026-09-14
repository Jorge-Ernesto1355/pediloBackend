import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from './prisma';

if (!process.env.BETTER_AUTH_SECRET) {
  throw new Error('BETTER_AUTH_SECRET is not defined');
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    minPasswordLenght: 8,
    maxPasswordLenght: 64,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  baseUrl: process.env.BETTER_AUTH_BASE_URL || 'http://localhost:3000',
  trustedOrigins: (process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
});
