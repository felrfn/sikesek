import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";

const registerTokenSchema = z.object({
  token: z.string().trim().min(1).max(4096),
  platform: z.enum(["android", "ios", "web"]).optional(),
  deviceId: z.string().trim().max(255).optional(),
});

/**
 * FCM token registration for the mobile app (section 34/docs/MOBILE_API.md).
 * The token is always associated with the AUTHENTICATED caller - the
 * request body never supplies a userId, so a client can never register a
 * token for another user. Upserts by the token's own unique constraint so
 * repeated registration (e.g. app restart) is idempotent and just bumps
 * `lastSeenAt`/re-activates it rather than creating a duplicate row.
 */
export async function POST(request: Request) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = registerTokenSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Invalid push token payload" } },
      { status: 400 },
    );
  }

  const { token, platform, deviceId } = parsed.data;

  await prisma.userFcmToken.upsert({
    where: { token },
    update: {
      userId: auth.user.id,
      platform,
      deviceId,
      isActive: true,
      lastSeenAt: new Date(),
    },
    create: {
      userId: auth.user.id,
      token,
      platform,
      deviceId,
    },
  });

  return NextResponse.json({ ok: true });
}
