import { z } from 'zod';

export const notificationSubscriptionCreateSchema = z.object({
  base_currency: z.string().length(3).transform(val => val.toUpperCase()),
  target_currency: z.string().length(3).transform(val => val.toUpperCase()),
  threshold: z.number().positive(),
  condition: z.enum(['above', 'below']),
}).refine(data => data.base_currency !== data.target_currency, {
  message: "Base and target currencies must be different",
  path: ["target_currency"],
});

export const notificationSubscriptionOutSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  base_currency: z.string().length(3),
  target_currency: z.string().length(3),
  threshold: z.number(),
  condition: z.string(),
  is_active: z.boolean(),
  last_triggered_at: z.coerce.date().nullable().optional(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date(),
});
