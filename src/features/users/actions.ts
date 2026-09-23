"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  createUserSchema,
  resetPasswordSchema,
  updateUserSchema,
} from "@/lib/validation/user";

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createUser(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = createUserSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Invalid user data" };

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        username: parsed.data.username,
        email: parsed.data.email,
        phone: parsed.data.phone,
        role: parsed.data.role,
        hashedPassword,
        approvedAt: new Date(),
      },
    });
  } catch {
    return { error: "A user with this email or username already exists" };
  }

  revalidatePath("/admin/users");
  return {};
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

export async function resetUserPassword(
  userId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = resetPasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Password must be at least 8 characters" };

  const hashedPassword = await bcrypt.hash(parsed.data.password, 10);
  await prisma.user.update({
    where: { id: userId },
    data: { hashedPassword },
  });

  return {};
}
