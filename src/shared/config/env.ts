import 'dotenv/config';
import { z } from 'zod';

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(3000),
    DATABASE_URL: z.string().min(1),
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
