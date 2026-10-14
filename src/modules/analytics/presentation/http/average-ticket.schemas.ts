import { z } from 'zod';

export const averageTicketQuerySchema = z.object({
  period: z.enum(['today', '7d', '30d', 'this_month']).default('today'),
});
