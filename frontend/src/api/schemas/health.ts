import { z } from 'zod';

export const healthCheckOutSchema = z.object({
  status: z.string(),
  timestamp: z.string(), // Healthcheck returns isoformat string
  services: z.object({
    database: z.string(),
    cache: z.string(),
  }),
});
