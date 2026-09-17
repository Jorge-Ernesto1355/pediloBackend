import { z } from 'zod';

const optionalUrl = z.string().url().optional();
const nullableUrl = z.string().url().nullable().optional();

const businessScheduleDaySchema = z.object({
  key: z.string().trim().min(1),
  label: z.string().trim().min(1),
  enabled: z.boolean(),
});

const businessScheduleSchema = z.object({
  days: z.array(businessScheduleDaySchema),
  openTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid opening time format'),
  closeTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Invalid closing time format'),
});

const coordinatesSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
});

const ubicationMapsSchema = coordinatesSchema.nullable().optional();

export const createBusinessSchema = z
  .object({
    name: z.string().trim().min(5).max(40),

    slug: z
      .string()
      .trim()
      .min(5)
      .max(40)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),

    description: z.string().trim().max(300).optional(),

    logoUrl: optionalUrl,

    coverUrl: optionalUrl,

    ubication: z.string().trim().max(255).optional(),

    ubicationMaps: ubicationMapsSchema,

    businessSchedule: businessScheduleSchema.optional(),
  })
  .strict();

export const updateBusinessSchema = z
  .object({
    name: z.string().trim().min(5).max(40).optional(),

    slug: z
      .string()
      .trim()
      .min(5)
      .max(40)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional(),

    description: z.string().trim().max(300).nullable().optional(),

    logoUrl: nullableUrl,

    coverUrl: nullableUrl,

    ubication: z.string().trim().max(255).nullable().optional(),

    ubicationMaps: ubicationMapsSchema,

    businessSchedule: businessScheduleSchema.optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, 'At least one field is required');

export const businessIdSchema = z.object({ id: z.string().min(1) });
export const businessSlugSchema = z.object({ slug: z.string().min(1) });
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
