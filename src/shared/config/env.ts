import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    // Logical Pedilo environment. NODE_ENV is the runtime mode and is not
    // sufficient on Render/Vercel, where Development also runs in production mode.
    PEDILO_ENV: z.enum(['local', 'development', 'production']).default('local'),
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3001),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_BASE_URL: z.string().url().optional(),
    TRUSTED_ORIGINS: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    FRONTEND_URL: z.string().url().optional(),
    APP_NAME: z.string().min(1).default('Pedilo'),
    PASSWORD_RESET_TOKEN_EXPIRATION_MINUTES: z.coerce.number().int().min(5).max(120).default(30),
    EMAIL_VERIFICATION_TOKEN_EXPIRATION_MINUTES: z.coerce
      .number()
      .int()
      .min(5)
      .max(1440)
      .default(60),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_FROM: z.string().optional(),
    REQUEST_LOGGING: z.enum(['true', 'false']).default('true'),
    SENTRY_DSN: z.string().url().optional(),
    SENTRY_RELEASE: z.string().min(1).optional(),
  })
  .superRefine((values, context) => {
    if (values.NODE_ENV === 'production' && values.BETTER_AUTH_SECRET.length < 32) {
      context.addIssue({
        code: z.ZodIssueCode.custom,

        path: ['BETTER_AUTH_SECRET'],
        message: 'BETTER_AUTH_SECRET must contain at least 32 characters in production',
      });
    }
    if (Boolean(values.GOOGLE_CLIENT_ID) !== Boolean(values.GOOGLE_CLIENT_SECRET)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['GOOGLE_CLIENT_ID'],
        message: 'Google OAuth requires both GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
      });
    }
    const expectedFrontendUrl = {
      local: 'http://localhost:3000',
      development: 'https://dev.pedilo.mx',
      production: 'https://pedilo.mx',
    }[values.PEDILO_ENV];
    const expectedBackendUrl = {
      local: `http://localhost:${values.PORT}`,
      development: 'https://api-dev.pedilo.mx',
      production: 'https://api.pedilo.mx',
    }[values.PEDILO_ENV];
    if (values.FRONTEND_URL && values.FRONTEND_URL.replace(/\/$/, '') !== expectedFrontendUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FRONTEND_URL'],
        message: `FRONTEND_URL debe ser ${expectedFrontendUrl} para PEDILO_ENV=${values.PEDILO_ENV}`,
      });
    }
    if (values.BETTER_AUTH_BASE_URL) {
      const configuredBackendOrigin = new URL(values.BETTER_AUTH_BASE_URL).origin;
      if (configuredBackendOrigin !== new URL(expectedBackendUrl).origin) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['BETTER_AUTH_BASE_URL'],
          message: `BETTER_AUTH_BASE_URL debe ser ${expectedBackendUrl} para PEDILO_ENV=${values.PEDILO_ENV}`,
        });
      }
    }
    if (
      values.NODE_ENV === 'production' &&
      !(values.FRONTEND_URL ?? expectedFrontendUrl).startsWith('https://')
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['FRONTEND_URL'],
        message: 'FRONTEND_URL must use HTTPS in production',
      });
    }
    if (values.NODE_ENV === 'production' && (!values.RESEND_API_KEY || !values.EMAIL_FROM)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['RESEND_API_KEY'],
        message: 'Resend email configuration is required in production',
      });
    }
    if (values.EMAIL_FROM?.includes('example.com')) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_FROM'],
        message:
          'EMAIL_FROM cannot use example.com; use onboarding@resend.dev or a verified domain',
      });
    }
  });

export const env = envSchema.parse(process.env);

const defaultFrontendUrls = {
  local: 'http://localhost:3000',
  development: 'https://dev.pedilo.mx',
  production: 'https://pedilo.mx',
} as const;

const defaultBackendUrls = {
  local: `http://localhost:${env.PORT}`,
  development: 'https://api-dev.pedilo.mx',
  production: 'https://api.pedilo.mx',
} as const;

export const frontendUrl = env.FRONTEND_URL ?? defaultFrontendUrls[env.PEDILO_ENV];
const defaultBaseUrl = defaultBackendUrls[env.PEDILO_ENV];

export const authBaseUrl = env.BETTER_AUTH_BASE_URL ?? defaultBaseUrl;

const configuredTrustedOrigins = (env.TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const trustedOrigins =
  configuredTrustedOrigins.length > 0
    ? configuredTrustedOrigins
    : env.NODE_ENV === 'production'
      ? [frontendUrl]
      : [frontendUrl, 'http://localhost:3001'];
