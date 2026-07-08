import { z } from 'zod';

export const userProfileUpdateSchema = z.object({
  email: z.string().email().optional(),
  first_name: z.string().max(100).optional(),
  last_name: z.string().max(100).optional(),
});

export const userPasswordChangeSchema = z.object({
  current_password: z.string().min(8),
  new_password: z.string().min(8),
}).refine((data) => data.current_password !== data.new_password, {
  message: "New password must be different from current password",
  path: ["new_password"],
});
