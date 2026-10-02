import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

/**
 * Sets the officer's own password and clears `mustChangePassword`. This is
 * the ONLY mobile endpoint reachable while `mustChangePassword` is set -
 * every other route rejects with `PASSWORD_CHANGE_REQUIRED` until this
 * succeeds (see requireMobileAuth.ts). Still requires the current
 * (admin-generated) password, so a stolen/leaked access token alone cannot
 * be used to lock the real user out by changing their password.
 */
export async function POST(request: Request) {
  const auth = await requireMobileAuth(request, { allowPasswordChangeRequired: true });
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "currentPassword and newPassword (min 8 characters) are required",
        },
      },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUniqueOrThrow({ where: { id: auth.user.id } });
  const currentMatches = await bcrypt.compare(parsed.data.currentPassword, user.hashedPassword);
  if (!currentMatches) {
    return NextResponse.json(
      { error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect." } },
      { status: 401 },
    );
  }

  const hashedPassword = await bcrypt.hash(parsed.data.newPassword, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: { hashedPassword, mustChangePassword: false },
  });

  return NextResponse.json({ ok: true });
}
