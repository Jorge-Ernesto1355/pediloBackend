import { z } from 'zod';
import { isSafeGoogleReviewsUrl } from '../../domain/google-reviews-url.js';

export const googleReviewLinkSchema = z.object({
  url: z
    .string()
    .trim()
    .url()
    .max(2048)
    .refine(isSafeGoogleReviewsUrl, 'URL must be a valid HTTPS Google link'),
});
