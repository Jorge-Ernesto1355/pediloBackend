import { z } from 'zod';

export const googleReviewStatsQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d', 'thisMonth']).default('today'),
});
