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

const tokenResponseInputSchema = z.object({
  access_token: z.string().optional(),
  accessToken: z.string().optional(),
  token: z.string().optional(),
  refresh_token: z.string().optional(),
  refreshToken: z.string().optional(),
  token_type: z.string().optional(),
  tokenType: z.string().optional(),
});

export const tokenSchema = tokenResponseInputSchema
  .refine(
    (value) =>
      Boolean(value.access_token ?? value.accessToken ?? value.token) &&
      Boolean(value.refresh_token ?? value.refreshToken),
    {
      message: 'Invalid token payload.',
    }
  )
  .transform((value) => ({
    access_token: value.access_token ?? value.accessToken ?? value.token ?? '',
    refresh_token: value.refresh_token ?? value.refreshToken ?? '',
    token_type: value.token_type ?? value.tokenType ?? 'bearer',
  }));

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
