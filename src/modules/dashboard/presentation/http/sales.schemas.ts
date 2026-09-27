import { z } from 'zod';

export const salesQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d', 'thisMonth']),
});
