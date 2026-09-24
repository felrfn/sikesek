import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractBearerToken, verifyToken } from "./mobileJwt";

export type MobileAuthResult =
  | { ok: true; user: { id: string; role: "ADMIN" | "FIELD_OFFICER"; name: string; email: string } }
  | { ok: false; response: NextResponse };

/**
 * Every /api/mobile/* route (except auth/login and auth/refresh) calls this
 * first. See docs/MOBILE_API.md for the exact error shape mobile clients
 * should expect.
 */
export async function requireMobileAuth(request: Request): Promise<MobileAuthResult> {
  const token = extractBearerToken(request);
  if (!token) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "Missing bearer token" } },
        { status: 401 },
      ),
    };
  }

  const result = await verifyToken(token, "access");
  if (!result.ok) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: {
            code: result.reason === "EXPIRED" ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
            message:
              result.reason === "EXPIRED"
                ? "Access token has expired, use the refresh token."
                : "Invalid access token.",
          },
        },
        { status: 401 },
      ),
    };
  }

  const user = await prisma.user.findUnique({ where: { id: result.payload.sub } });
  if (!user || user.deletedAt || !user.approvedAt) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "ACCOUNT_INACTIVE", message: "Account is inactive." } },
        { status: 403 },
      ),
    };
  }

  return {
    ok: true,
    user: { id: user.id, role: user.role, name: user.name, email: user.email },
  };
}
