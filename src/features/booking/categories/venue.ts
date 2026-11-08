import type { BookingStatus, Venue } from "@prisma/client";
import { getVenueRentalWindow } from "@/lib/bookingWindow";
import type { CartItemInput } from "@/lib/validation/booking";
import { BookingConflictError } from "../errors";
import {
  BLOCKING_BOOKING_STATUSES,
  activePaymentFilter,
  hourRangesOverlap,
  type ConflictCheckClient,
} from "./shared";

export interface VenueLine {
  venueId: string;
  bookingDate: Date;
  startHour: number;
  endHour: number;
  pricePerHour: bigint;
  subtotal: bigint;
}

type VenueCartInput = Extract<CartItemInput, { type: "venue" }>;

export function timeAt(hour: number) {
  return new Date(`1970-01-01T${String(hour).padStart(2, "0")}:00:00.000Z`);
}

export function buildVenueLine(item: VenueCartInput, venue: Venue): VenueLine {
  const hours = item.endHour - item.startHour;
  const subtotal = venue.pricePerHour * BigInt(hours);
  return {
    venueId: venue.id,
    bookingDate: new Date(`${item.date}T00:00:00.000Z`),
    startHour: item.startHour,
    endHour: item.endHour,
    pricePerHour: venue.pricePerHour,
    subtotal,
  };
}

export function toVenueCreateData(line: VenueLine) {
  return {
    venueId: line.venueId,
    bookingDate: line.bookingDate,
    startTime: timeAt(line.startHour),
    endTime: timeAt(line.endHour),
    totalHours: line.endHour - line.startHour,
    pricePerHour: line.pricePerHour,
    subtotal: line.subtotal,
  };
}

/**
 * Venue-only variant of `stillHoldsSlot` above - homestay availability is
 * deliberately left exactly as `stillHoldsSlot` already computes it.
 *
 * A venue booking also releases its slot the instant an *early* checkout is
 * officially confirmed, rather than waiting for the originally scheduled
 * `endTime` - a checked-out meeting room is free the moment checkout
 * happens, not whenever its booked hour range would have ended anyway.
 * `checkedOutAt` is written exactly once, atomically with the CHECKED_IN ->
 * COMPLETED transition itself (`transitionBookingStatus` in
 * `src/features/bookings/service.ts`), so by the time any query can observe
 * `bookingStatus === "COMPLETED"` the slot is already supposed to be free -
 * there's no "confirmed but not yet recorded" gap to race.
 *
 * `checkedOutAt` can be `null` for a `COMPLETED` row that predates this
 * column (or if it's ever missing for any other reason) - that falls back
 * to the same schedule-based rule `stillHoldsSlot` uses, which is the safe
 * default (never frees a slot we can't actually prove is empty).
 */
export function stillHoldsVenueSlot(
  now: Date,
  bookingStatus: BookingStatus,
  validUntil: Date,
  checkedOutAt: Date | null,
) {
  if (bookingStatus !== "COMPLETED") return true;
  if (checkedOutAt) return false;
  return now <= validUntil;
}

export async function findVenueConflict(db: ConflictCheckClient, line: VenueLine) {
  const now = new Date();
  const sameDayBookings = await db.transactionVenue.findMany({
    where: {
      venueId: line.venueId,
      bookingDate: line.bookingDate,
      bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
      transaction: activePaymentFilter(now),
    },
  });

  return sameDayBookings.find(
    (existing) =>
      hourRangesOverlap(
        existing.startTime.getUTCHours(),
        existing.endTime.getUTCHours(),
        line.startHour,
        line.endHour,
      ) &&
      stillHoldsVenueSlot(
        now,
        existing.bookingStatus,
        getVenueRentalWindow(existing.bookingDate, existing.startTime, existing.endTime).validUntil,
        existing.checkedOutAt,
      ),
  );
}

export async function assertNoVenueConflict(
  db: ConflictCheckClient,
  line: VenueLine,
) {
  const conflict = await findVenueConflict(db, line);
  if (conflict) {
    throw new BookingConflictError(
      "This meeting point is already booked for an overlapping time slot.",
    );
  }
}
