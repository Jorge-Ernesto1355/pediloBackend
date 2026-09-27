import { z } from 'zod';

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Email inválido'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token requerido').max(512),
  newPassword: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres').max(64),
});
