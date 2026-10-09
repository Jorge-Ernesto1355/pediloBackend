import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { prisma } from './prisma';
import { authBaseUrl, env, trustedOrigins } from '@/shared/config/env.js';

const socialProviders =
  env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
    ? {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }
    : undefined;

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  socialProviders,
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 64,
    password: { hash: hashPassword, verify: verifyPassword },
    revokeSessionsOnPasswordReset: true,
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: authBaseUrl,
  trustedOrigins,
  useSecureCookies: env.NODE_ENV === 'production',
  defaultCookieAttributes: {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
  },
  advanced: {
    crossSubDomainCookies: {
      // OAuth starts on pedilo.mx but completes on api.pedilo.mx. Share the
      // session/state cookies based on the deployed auth host, not NODE_ENV;
      // the production runtime does not reliably provide that variable.
      enabled: new URL(authBaseUrl).hostname === 'api.pedilo.mx',
      domain: 'pedilo.mx',
    },
  },
});
