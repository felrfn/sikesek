import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import { consumeTicketByCode } from "@/features/tickets/service";

const bodySchema = z.object({ code: z.string().trim().min(1) });

/**
 * The single QR-scan entrypoint for the mobile app (see
 * docs/MOBILE_API.md#ticket-verification). Verifying and consuming happen
 * atomically: a code is only ever "used" once, and this is the one place
 * that can do it. Field officers and admins may both call this.
 */
export async function POST(request: Request) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "code is required" } },
      { status: 400 },
    );
  }

  const result = await consumeTicketByCode(parsed.data.code, auth.user.id);

  // HTTP status stays 200 for every well-formed verification outcome
  // (including INVALID/EXPIRED/etc.) - `status` in the body is the result
  // the mobile client should branch on, not the transport status.
  return NextResponse.json(result);
}
