import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signAccessToken, signRefreshToken } from "@/lib/auth/mobileJwt";

const bodySchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

/**
 * Mobile (field-officer) login. Deliberately separate from the web admin's
 * NextAuth credentials provider, which now only accepts ADMIN accounts
 * (see src/lib/auth/auth.ts) - a field-officer account issued here can
 * never obtain a web admin session.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "email and password are required" } },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });

  const invalidCredentials = NextResponse.json(
    { error: { code: "INVALID_CREDENTIALS", message: "Invalid email or password." } },
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
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      username: user.username,
      role: user.role,
    },
  });
}
