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

/**
 * Self-service password change (`/admin/account`) - the web counterpart of
 * `POST /api/mobile/auth/change-password`. Deliberately not trimmed:
 * whitespace is a valid password character (same rule as the mobile
 * endpoint, which also caps at bcrypt's 72-byte limit).
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Kata sandi saat ini wajib diisi."),
    newPassword: z
      .string()
      .min(8, "Kata sandi baru minimal 8 karakter.")
      .max(72, "Kata sandi baru maksimal 72 karakter."),
  })
  .refine((data) => data.newPassword !== data.currentPassword, {
    path: ["newPassword"],
    message: "Kata sandi baru harus berbeda dari kata sandi saat ini.",
  });
