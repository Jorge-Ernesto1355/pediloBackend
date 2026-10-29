import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { hashPassword, verifyPassword } from 'better-auth/crypto';
import { prisma } from './prisma';
import { authBaseUrl, env, trustedOrigins } from '@/shared/config/env.js';

export const LEGAL_TERMS_VERSION = '1.1';
export const LEGAL_PRIVACY_VERSION = '1.2';

const isHttpsDeployment = new URL(authBaseUrl).protocol === 'https:';
const cookiePrefix =
  env.PEDILO_ENV === 'production' ? 'better-auth' : `better-auth-${env.PEDILO_ENV}`;

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
  user: {
    additionalFields: {
      acceptLegalDocuments: { type: 'boolean', required: false, input: true },
      ageDeclaration: { type: 'boolean', required: false, input: true },
      legalTermsVersion: { type: 'string', required: false, input: false },
      legalPrivacyVersion: { type: 'string', required: false, input: false },
      legalAcceptedAt: { type: 'date', required: false, input: false },
    },
  },
  databaseHooks: {
    user: {
      create: {
        before: async (user, context) => {
          const body = context?.body as Record<string, unknown> | undefined;
          const isPasswordSignup = typeof body?.password === 'string';

          // Keep direct Better Auth email signups subject to the same requirement
          // as the legacy /api/v1/auth/register endpoint.
          if (isPasswordSignup && (body?.acceptLegalDocuments !== true || body?.ageDeclaration !== true)) {
            return false;
          }

          if (isPasswordSignup) {
            const acceptedAt = new Date();
            return {
              data: {
                ...user,
                acceptLegalDocuments: true,
                ageDeclaration: true,
                legalTermsVersion: LEGAL_TERMS_VERSION,
                legalPrivacyVersion: LEGAL_PRIVACY_VERSION,
                legalAcceptedAt: acceptedAt,
              },
            };
          }
        },
      },
    },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: authBaseUrl,
  trustedOrigins,
  advanced: {
    cookiePrefix,
    crossSubDomainCookies: {
      // Keep Development and Production isolated with different cookie names.
      enabled:
        env.PEDILO_ENV !== 'local' &&
        ['api.pedilo.mx', 'api-dev.pedilo.mx'].includes(new URL(authBaseUrl).hostname),
      domain: 'pedilo.mx',
    },
  },
  useSecureCookies: isHttpsDeployment,
  defaultCookieAttributes: {
    httpOnly: true,
    secure: isHttpsDeployment,
    sameSite: 'lax',
  },
});
