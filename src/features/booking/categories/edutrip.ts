import type { EdutripPackage } from "@prisma/client";
import { getEdutripRentalWindow } from "@/lib/bookingWindow";
import type { CartItemInput } from "@/lib/validation/booking";
import { BookingConflictError } from "../errors";
import {
  BLOCKING_BOOKING_STATUSES,
  activePaymentFilter,
  stillHoldsSlot,
  type ConflictCheckClient,
} from "./shared";

export interface EdutripLine {
  packageId: string;
  visitDate: Date;
  pax: number;
  pricePerPax: bigint;
  subtotal: bigint;
}

type EdutripCartInput = Extract<CartItemInput, { type: "edutrip" }>;

export function buildEdutripLine(
  item: EdutripCartInput,
  pkg: EdutripPackage,
): EdutripLine {
  const subtotal = pkg.pricePerPax * BigInt(item.pax);
  return {
    packageId: pkg.id,
    visitDate: new Date(`${item.date}T00:00:00.000Z`),
    pax: item.pax,
    pricePerPax: pkg.pricePerPax,
    subtotal,
  };
}

export function toEdutripCreateData(line: EdutripLine) {
  return {
    packageId: line.packageId,
    visitDate: line.visitDate,
    paxCount: line.pax,
    pricePerPax: line.pricePerPax,
    subtotal: line.subtotal,
  };
}

/**
 * Edutrip is treated as one exclusive daily slot per package: one package can
 * only have one active booking per visit date (08:00-17:00 WIB). A PENDING
 * booking holds the slot until its payment deadline, exactly like the other
 * categories; a COMPLETED one keeps it until the fixed end of the day's
 * window (there is no per-booking checkout timestamp for edutrip).
 */
export async function findEdutripConflict(
  db: ConflictCheckClient,
  line: EdutripLine,
) {
  const now = new Date();
  const sameDayBookings = await db.transactionEdutrip.findMany({
    where: {
      packageId: line.packageId,
      visitDate: line.visitDate,
      bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
      transaction: activePaymentFilter(now),
    },
  });

  return sameDayBookings.find((existing) =>
    stillHoldsSlot(
      now,
      existing.bookingStatus,
      getEdutripRentalWindow(existing.visitDate).validUntil,
    ),
  );
}

export async function assertNoEdutripConflict(
  db: ConflictCheckClient,
  line: EdutripLine,
) {
  const conflict = await findEdutripConflict(db, line);
  if (conflict) {
    throw new BookingConflictError(
      "This Edutrip package is already booked for the selected date.",
    );
  }
}
