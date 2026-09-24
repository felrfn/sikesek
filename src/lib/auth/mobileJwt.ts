import { SignJWT, jwtVerify, errors as joseErrors } from "jose";

/**
 * Mobile (field-officer) auth is a separate bearer-JWT scheme from the web
 * admin's cookie-based NextAuth session (see docs/MOBILE_API.md). Reuses
 * AUTH_SECRET by default so no extra env var is required to get started,
 * but a dedicated MOBILE_JWT_SECRET can be set to let the two be rotated
 * independently in production.
 */
function getSecret() {
  const secret = process.env.MOBILE_JWT_SECRET ?? process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET is not configured");
  return new TextEncoder().encode(secret);
}

const ACCESS_TOKEN_TTL = "1h";
const REFRESH_TOKEN_TTL = "30d";

export interface MobileTokenPayload {
  sub: string;
  role: "ADMIN" | "FIELD_OFFICER";
}

export async function signAccessToken(payload: MobileTokenPayload) {
  return new SignJWT({ ...payload, type: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_TTL)
    .sign(getSecret());
}

export async function signRefreshToken(payload: MobileTokenPayload) {
  return new SignJWT({ ...payload, type: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(REFRESH_TOKEN_TTL)
    .sign(getSecret());
}

export type VerifyResult =
  | { ok: true; payload: MobileTokenPayload & { type: "access" | "refresh" } }
  | { ok: false; reason: "EXPIRED" | "INVALID" };

export async function verifyToken(
  token: string,
  expectedType: "access" | "refresh",
): Promise<VerifyResult> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (payload.type !== expectedType) {
      return { ok: false, reason: "INVALID" };
    }
    return {
      ok: true,
      payload: payload as unknown as MobileTokenPayload & {
        type: "access" | "refresh";
      },
    };
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      return { ok: false, reason: "EXPIRED" };
    }
    return { ok: false, reason: "INVALID" };
  }
}

export function extractBearerToken(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  return header.slice("Bearer ".length).trim();
}
