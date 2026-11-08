import { Prisma, type BookingStatus, type Holiday } from "@prisma/client";
import { isDateClosedForBooking } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

// A booking in this set still "holds" the slot when its payment is still
// active. PENDING only holds until `paymentExpiresAt` - once that deadline
// passes, the slot is free again immediately even if the expiry job has not
// run yet (the job only has to clean up the payment/booking rows, not keep
// the calendar correct). CANCELLED/REJECTED bookings, and payments that
// ended FAILED/EXPIRED, never block availability.
export const BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
];

export function activePaymentFilter(now: Date): Prisma.TransactionWhereInput {
  return {
    OR: [
      { paymentStatus: "PAID" },
      { paymentStatus: "PENDING", paymentExpiresAt: { gt: now } },
    ],
  };
}

/**
 * Second-stage filter applied to every row the `BLOCKING_BOOKING_STATUSES`
 * query returns, because that status set alone is too coarse for COMPLETED.
 *
 * COMPLETED means the visitor has checked out, so the booking only keeps
 * holding its slot until its rental window actually ends - once the window
 * has passed, the facility is physically free and must be rebookable.
 * Every other blocking status holds unconditionally: PENDING/CONFIRMED
 * visitors simply haven't arrived yet, and a CHECKED_IN one is still in
 * there even if they've overstayed (an overdue checkout must never free the
 * slot for someone else).
 *
 * Note COMPLETED is deliberately *not* dropped from the status set outright:
 * a guest can check out early (COMPLETED while the window is still running),
 * and until that window ends the night/slot they paid for is still theirs.
 *
 * `validUntil` comes from src/lib/bookingWindow.ts - the same single
 * definition of a rental window used for ticket validity and the mobile
 * remaining-time countdown - so "has ended" means the same thing everywhere.
 */
export function stillHoldsSlot(
  now: Date,
  bookingStatus: BookingStatus,
  validUntil: Date,
) {
  return bookingStatus !== "COMPLETED" || now <= validUntil;
}

export function hourRangesOverlap(
  existingStartHour: number,
  existingEndHour: number,
  startHour: number,
  endHour: number,
) {
  return existingStartHour < endHour && existingEndHour > startHour;
}

// Both `prisma` (the plain client, used for the early advisory check on the
// booking page) and `tx` (an interactive transaction client, used for the
// authoritative check at commit time) satisfy this - only the read methods
// these conflict checks need are declared here.
export interface ConflictCheckClient {
  transactionHomestay: { findMany: (typeof prisma)["transactionHomestay"]["findMany"] };
  transactionVenue: { findMany: (typeof prisma)["transactionVenue"]["findMany"] };
  transactionEdutrip: { findMany: (typeof prisma)["transactionEdutrip"]["findMany"] };
}

export function closedHolidayMessage(
  dateIso: string,
  holidays: Pick<Holiday, "date" | "isClosed">[],
) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  return isDateClosedForBooking(date, holidays)
    ? "This date is closed for bookings (holiday/maintenance)."
    : null;
}
