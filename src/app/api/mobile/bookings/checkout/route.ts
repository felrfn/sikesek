import { NextResponse } from "next/server";
import { z } from "zod";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import { checkoutBooking, InvalidBookingTransitionError } from "@/features/bookings/service";

const bodySchema = z.object({
  bookingType: z.enum(["homestay", "venue", "edutrip"]),
  bookingId: z.string().uuid(),
});

/**
 * A field officer ends a visitor's on-site stay/usage of a facility
 * (docs/MOBILE_API.md#booking-checkout) - the mobile-side counterpart to
 * `POST /api/mobile/tickets/verify`'s check-in. Same CHECKED_IN -> COMPLETED
 * transition the web admin's "Complete" action performs, reused as-is
 * (`checkoutBooking` in src/features/bookings/service.ts), with the officer
 * attributed via the normal audit log.
 */
export async function POST(request: Request) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "bookingType (homestay/venue/edutrip) and bookingId (UUID) are required",
        },
      },
      { status: 400 },
    );
  }

  try {
    const result = await checkoutBooking(parsed.data.bookingType, parsed.data.bookingId, {
      id: auth.user.id,
      name: auth.user.name,
    });
    return NextResponse.json({ ...result, checkedOutAt: new Date().toISOString() });
  } catch (error) {
    if (error instanceof InvalidBookingTransitionError) {
      const isNotFound = error.reason === "NOT_FOUND";
      return NextResponse.json(
        {
          error: {
            code: isNotFound ? "NOT_FOUND" : "INVALID_BOOKING_STATE",
            message: error.message,
          },
        },
        { status: isNotFound ? 404 : 409 },
      );
    }
    throw error;
  }
}
