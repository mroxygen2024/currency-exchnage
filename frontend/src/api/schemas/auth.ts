import { z } from 'zod';

export const userOutSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  is_active: z.boolean(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  role: z.string(),
  is_deleted: z.boolean(),
});

export const tokenSchema = z.object({
  access_token: z.string(),
  token_type: z.string().default('bearer'),
  refresh_token: z.string(),
});

export const tokenPayloadSchema = z.object({
  sub: z.string().nullable().optional(),
  exp: z.number().nullable().optional(),
});

export const registerRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
});

export const loginRequestSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
