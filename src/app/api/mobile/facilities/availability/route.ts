import { NextResponse } from "next/server";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import { facilityAvailabilityQuerySchema } from "@/lib/validation/booking";
import { getFacilityAvailability, getFacilityAvailabilityRange } from "@/features/booking/service";

/**
 * Facility availability for a single date, or a date range, and (for
 * venues) an optional hour range - see
 * docs/MOBILE_API.md#facility-availability. Available to both roles, like
 * the other mobile read endpoints - checking availability on-site isn't
 * admin-only.
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

  const timeRange =
    parsed.data.startHour !== undefined
      ? { startHour: parsed.data.startHour, endHour: parsed.data.endHour }
      : null;

  // Exactly one of `date` or `startDate`/`endDate` is guaranteed by the
  // schema's superRefine - the single-date response shape is unchanged
  // from before range support existed, for backward compatibility.
  if (parsed.data.date !== undefined) {
    const facilities = await getFacilityAvailability({
      date: parsed.data.date,
      category: parsed.data.category,
      startHour: parsed.data.startHour,
      endHour: parsed.data.endHour,
    });
    return NextResponse.json({ date: parsed.data.date, timeRange, facilities });
  }

  const dates = await getFacilityAvailabilityRange({
    startDate: parsed.data.startDate!,
    endDate: parsed.data.endDate!,
    category: parsed.data.category,
    startHour: parsed.data.startHour,
    endHour: parsed.data.endHour,
  });
  return NextResponse.json({
    startDate: parsed.data.startDate,
    endDate: parsed.data.endDate,
    timeRange,
    dates,
  });
}
