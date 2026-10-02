import { z } from "zod";

// `password` is intentionally absent here - admins no longer choose a
// user's password. createUser() generates one randomly server-side (see
// src/lib/password.ts) and returns it once for the admin to share.
export const createUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(["ADMIN", "FIELD_OFFICER"]),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(40),
  email: z.string().trim().email(),
  phone: z.string().trim().max(20).optional(),
  role: z.enum(["ADMIN", "FIELD_OFFICER"]),
  approved: z.coerce.boolean(),
});
