"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { logAudit } from "@/lib/audit";
import { generateRandomPassword } from "@/lib/password";
import {
  changePasswordSchema,
  createUserSchema,
  updateOwnProfileSchema,
  updateUserSchema,
} from "@/lib/validation/user";

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
  // The built-in admin's phone/email power the public footer, so refresh the
  // root layout when they are edited from User Management too.
  revalidatePath("/", "layout");
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

/**
 * Soft-deletes a staff account: it disappears from the user list and every
 * auth path (web credentials, requireAdmin, requireMobileAuth) rejects it,
 * while KTR assignments, tickets, schedules, audit logs, and refunds keep
 * their historical references. Hard delete is intentionally not used -
 * those relations are required and would block/erase history.
 */
export async function deleteUser(userId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  if (admin.id === userId) {
    return { error: "Anda tidak dapat menghapus akun sendiri." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) {
    return { error: "Pengguna tidak ditemukan." };
  }

  if (target.role === "ADMIN") {
    const otherActiveAdmins = await prisma.user.count({
      where: {
        id: { not: userId },
        role: "ADMIN",
        deletedAt: null,
        approvedAt: { not: null },
      },
    });
    if (otherActiveAdmins === 0) {
      return { error: "Tidak dapat menghapus admin aktif terakhir." };
    }
  }

  await prisma.$transaction([
    prisma.userFcmToken.updateMany({
      where: { userId, isActive: true },
      data: { isActive: false },
    }),
    prisma.user.update({
      where: { id: userId },
      data: { deletedAt: new Date(), approvedAt: null },
    }),
  ]);

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: "user.deleted",
    entityType: "User",
    entityId: userId,
    metadata: {
      name: target.name,
      email: target.email,
      role: target.role,
    },
  });

  revalidatePath("/admin/users");
  return {};
}

/**
 * Lets the signed-in admin edit their own profile name, email, and phone
 * (`/admin/account`). Username and role are intentionally not self-editable:
 * username is an account identifier and role changes stay an explicit admin
 * action in User Management.
 *
 * Email must stay unique because it is the web login credential. We check it
 * up front for a friendly message and still handle the P2002 race in case
 * another request claims the same address between the check and the update.
 */
export async function updateOwnProfile(
  formData: FormData,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const parsed = updateOwnProfileSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Data profil tidak valid.",
    };
  }

  const { name, email } = parsed.data;
  const phone = parsed.data.phone?.trim() || null;

  const emailTaken = await prisma.user.findFirst({
    where: { email, id: { not: admin.id } },
    select: { id: true },
  });
  if (emailTaken) return { error: "Email sudah digunakan akun lain." };

  try {
    await prisma.user.update({
      where: { id: admin.id },
      data: { name, email, phone },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { error: "Email sudah digunakan akun lain." };
    }
    throw error;
  }

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: "user.profile.updated",
    entityType: "User",
    entityId: admin.id,
    metadata: {
      name,
      email,
      previousEmail: admin.email,
    },
  });

  revalidatePath("/admin/account");
  // Public pages render the footer/widget from this same admin row; invalidate
  // the root layout so a phone/email change is visible without a redeploy.
  revalidatePath("/", "layout");
  return {};
}

/**
 * Lets the signed-in admin set their own password (`/admin/account`) - the
 * web counterpart of the mobile change-password endpoint, and the only web
 * flow where a password is chosen by its owner rather than generated.
 * requireAdmin() already re-read the user from the database, so the current
 * password is checked against the live hash rather than the stateless JWT.
 *
 * Existing sessions are intentionally left alone: NextAuth's JWT strategy is
 * stateless, so changing the password does not revoke sessions on other
 * devices (they expire on their own).
 */
export async function changeOwnPassword(
  formData: FormData,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const parsed = changePasswordSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Data kata sandi tidak valid.",
    };
  }

  const currentMatches = await bcrypt.compare(
    parsed.data.currentPassword,
    admin.hashedPassword,
  );
  if (!currentMatches) return { error: "Kata sandi saat ini salah." };

  const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);

  await prisma.user.update({
    where: { id: admin.id },
    data: { hashedPassword, mustChangePassword: false },
  });

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: "user.password.changed",
    entityType: "User",
    entityId: admin.id,
  });

  revalidatePath("/admin/account");
  return {};
}
