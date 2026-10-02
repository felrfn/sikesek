import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken } from "@/lib/auth/mobileJwt";

const bodySchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

/**
 * Mobile (field-officer) login. Deliberately separate from the web admin's
 * NextAuth credentials provider, which now only accepts ADMIN accounts
 * (see src/lib/auth/auth.ts) - a field-officer account issued here can
 * never obtain a web admin session.
 *
 * Authenticates by `username`, not `email` - the web admin login is
 * unaffected and still uses email; this is a mobile-only change. Accounts
 * are created by an admin with a randomly-generated password (never chosen
 * by the admin) - `mustChangePassword` in the response tells the app to
 * force the officer into a change-password screen before anything else.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "username and password are required" } },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { username: parsed.data.username } });

  const invalidCredentials = NextResponse.json(
    { error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password." } },
    { status: 401 },
  );

  if (!user || user.deletedAt) return invalidCredentials;
  if (user.role !== "FIELD_OFFICER") {
    return NextResponse.json(
      {
        error: {
          code: "WRONG_CLIENT",
          message: "This account is not a field-officer account.",
        },
      },
      { status: 403 },
    );
  }

  const passwordMatches = await bcrypt.compare(parsed.data.password, user.hashedPassword);
  if (!passwordMatches) return invalidCredentials;

  if (!user.approvedAt) {
    return NextResponse.json(
      {
        error: {
          code: "ACCOUNT_PENDING_APPROVAL",
          message: "This account has not been approved by an admin yet.",
        },
      },
      { status: 403 },
    );
  }

  const tokenPayload = { sub: user.id, role: user.role } as const;
  const [accessToken, refreshToken] = await Promise.all([
    signAccessToken(tokenPayload),
    signRefreshToken(tokenPayload),
  ]);

  return NextResponse.json({
    accessToken,
    refreshToken,
    mustChangePassword: user.mustChangePassword,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
    },
  });
}
