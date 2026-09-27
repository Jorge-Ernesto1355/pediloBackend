import { z } from 'zod';

export const updateAccountSchema = z
  .object({
    name: z.string().min(2, 'The name must contain at least 2 characters').max(100),
  })
  .strict();

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(8).max(64),
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    token: z.string().min(1).max(512),
  })
  .strict();
