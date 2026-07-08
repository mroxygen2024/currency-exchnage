import { z } from 'zod';

export const favoritePairCreateSchema = z.object({
  base_currency: z.string().length(3).transform(val => val.toUpperCase()),
  target_currency: z.string().length(3).transform(val => val.toUpperCase()),
}).refine(data => data.base_currency !== data.target_currency, {
  message: "Base and target currencies must be different",
  path: ["target_currency"],
});

export const favoritePairOutSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  base_currency: z.string().length(3),
  target_currency: z.string().length(3),
  created_at: z.coerce.date(),
});
