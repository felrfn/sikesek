import { z } from "zod";

export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(["ADMIN", "FIELD_OFFICER"]),
  password: z.string().min(8).max(72),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(["ADMIN", "FIELD_OFFICER"]),
  approved: z.coerce.boolean(),
});

export const resetPasswordSchema = z.object({
  password: z.string().min(8).max(72),
});
