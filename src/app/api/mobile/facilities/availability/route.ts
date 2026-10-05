import { NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import { facilityAvailabilityQuerySchema } from "@/lib/validation/booking";
import { getFacilityAvailability } from "@/features/booking/service";

/**
 * Facility availability for a date (and, for venues, an optional hour
 * range) - see docs/MOBILE_API.md#facility-availability. Available to both
 * roles, like the other mobile read endpoints - checking availability
 * on-site isn't admin-only.
 */
export async function POST(request: Request) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const parsed = facilityAvailabilityQuerySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: parsed.error.issues[0]?.message ?? "Invalid availability query",
        },
      },
      { status: 400 },
    );
  }

  const facilities = await getFacilityAvailability(parsed.data);

  return NextResponse.json({
    date: parsed.data.date,
    timeRange:
      parsed.data.startHour !== undefined
        ? { startHour: parsed.data.startHour, endHour: parsed.data.endHour }
        : null,
    facilities,
  });
}
