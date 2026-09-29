import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(1),
    BETTER_AUTH_BASE_URL: z.string().url().optional(),
    TRUSTED_ORIGINS: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().min(1).optional(),
    GOOGLE_CLIENT_SECRET: z.string().min(1).optional(),
    CLOUDINARY_CLOUD_NAME: z.string().optional(),
    CLOUDINARY_API_KEY: z.string().optional(),
    CLOUDINARY_API_SECRET: z.string().optional(),
    FRONTEND_URL: z.string().url().default('http://localhost:3000'),
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
    if (values.NODE_ENV === 'production' && !values.FRONTEND_URL.startsWith('https://')) {
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

const defaultBaseUrl =
  env.NODE_ENV === 'production' ? 'https://api.pedilo.mx' : `http://localhost:${env.PORT}`;

export const authBaseUrl = env.BETTER_AUTH_BASE_URL ?? defaultBaseUrl;

const configuredTrustedOrigins = (env.TRUSTED_ORIGINS ?? '')
  .split(',')
  .map((origin) => origin.trim().replace(/\/$/, ''))
  .filter(Boolean);

export const trustedOrigins =
  configuredTrustedOrigins.length > 0
    ? configuredTrustedOrigins
    : env.NODE_ENV === 'production'
      ? [env.FRONTEND_URL]
      : [env.FRONTEND_URL, 'http://localhost:3001'];
