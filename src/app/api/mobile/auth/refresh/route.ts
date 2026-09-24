import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { signAccessToken, verifyToken } from "@/lib/auth/mobileJwt";

const bodySchema = z.object({ refreshToken: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "refreshToken is required" } },
      { status: 400 },
    );
  }

  const result = await verifyToken(parsed.data.refreshToken, "refresh");
  if (!result.ok) {
    return NextResponse.json(
      {
        error: {
          code: result.reason === "EXPIRED" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
          message:
            result.reason === "EXPIRED"
              ? "Refresh token has expired, please log in again."
              : "Invalid refresh token.",
        },
      },
      { status: 401 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: result.payload.sub } });
  if (!user || user.deletedAt || !user.approvedAt) {
    return NextResponse.json(
      { error: { code: "ACCOUNT_INACTIVE", message: "Account is inactive." } },
      { status: 403 },
    );
  }

  const accessToken = await signAccessToken({ sub: user.id, role: user.role });
  return NextResponse.json({ accessToken });
}
