"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { generateRandomPassword } from "@/lib/password";
import { createUserSchema, updateUserSchema } from "@/lib/validation/user";

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

/**
 * Admins never choose a user's password (section: user management) - a
 * random one is generated here, hashed immediately, and returned once in
 * the result for the admin to copy/share. `mustChangePassword` forces the
 * user to set their own password before they can use the account for
 * anything else (enforced server-side - see requireMobileAuth.ts).
 */
export async function createUser(
  formData: FormData,
): Promise<{ error?: string; password?: string }> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Invalid user data" };

  const generatedPassword = generateRandomPassword();
  const hashedPassword = await bcrypt.hash(generatedPassword, 10);

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        username: parsed.data.username,
        email: parsed.data.email,
        phone: parsed.data.phone,
        role: parsed.data.role,
        hashedPassword,
        mustChangePassword: true,
        approvedAt: new Date(),
      },
    });
  } catch {
    return { error: "A user with this email or username already exists" };
  }

  revalidatePath("/admin/users");
  return { password: generatedPassword };
}

export async function updateUser(
  userId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = updateUserSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Invalid user data" };

  await prisma.user.update({
    where: { id: userId },
    data: {
      name: parsed.data.name,
      username: parsed.data.username,
      email: parsed.data.email,
      phone: parsed.data.phone,
      role: parsed.data.role,
      approvedAt: parsed.data.approved ? new Date() : null,
    },
  });

  revalidatePath("/admin/users");
  return {};
}

/**
 * Resets a user's password to a freshly-generated random one and flags the
 * account for a mandatory password change on next use - never to an
 * admin-supplied value.
 */
export async function resetUserPassword(
  userId: string,
): Promise<{ error?: string; password?: string }> {
  await requireAdmin();

  const generatedPassword = generateRandomPassword();
  const hashedPassword = await bcrypt.hash(generatedPassword, 10);

  await prisma.user.update({
    where: { id: userId },
    data: { hashedPassword, mustChangePassword: true },
  });

  return { password: generatedPassword };
}
