import type { Holiday, Homestay, HomestaySpecialPrice } from "@prisma/client";
import { getHomestayRentalWindow } from "@/lib/bookingWindow";
import { getHomestayNightlyRate } from "@/lib/pricing";
import type { CartItemInput } from "@/lib/validation/booking";
import { BookingConflictError } from "../errors";
import {
  BLOCKING_BOOKING_STATUSES,
  activePaymentFilter,
  stillHoldsSlot,
  type ConflictCheckClient,
} from "./shared";

export interface HomestayLine {
  homestayId: string;
  checkInDate: Date;
  checkOutDate: Date;
  pricePerNight: bigint;
  subtotal: bigint;
}

type HomestayCartInput = Extract<CartItemInput, { type: "homestay" }>;
type HomestayWithSpecialPrices = Homestay & { specialPrices: HomestaySpecialPrice[] };

export function buildHomestayLine(
  item: HomestayCartInput,
  homestay: HomestayWithSpecialPrices,
  holidays: Pick<Holiday, "date" | "isClosed">[],
): HomestayLine {
  const checkIn = new Date(`${item.date}T00:00:00.000Z`);
  const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
  const { amount } = getHomestayNightlyRate(
    homestay,
    checkIn,
    homestay.specialPrices,
    holidays,
  );
  return {
    homestayId: homestay.id,
    checkInDate: checkIn,
    checkOutDate: checkOut,
    pricePerNight: amount,
    subtotal: amount,
  };
}

export function toHomestayCreateData(line: HomestayLine) {
  return {
    homestayId: line.homestayId,
    checkInDate: line.checkInDate,
    checkOutDate: line.checkOutDate,
    totalNights: 1,
    pricePerNight: line.pricePerNight,
    subtotal: line.subtotal,
  };
}

export async function findHomestayConflict(
  db: ConflictCheckClient,
  line: HomestayLine,
) {
  const now = new Date();
  const sameDayBookings = await db.transactionHomestay.findMany({
    where: {
      homestayId: line.homestayId,
      checkInDate: line.checkInDate,
      bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
      transaction: activePaymentFilter(now),
    },
  });

  return sameDayBookings.find((existing) =>
    stillHoldsSlot(
      now,
      existing.bookingStatus,
      getHomestayRentalWindow(existing.checkInDate, existing.checkOutDate).validUntil,
    ),
  );
}

export async function assertNoHomestayConflict(
  db: ConflictCheckClient,
  line: HomestayLine,
) {
  const conflict = await findHomestayConflict(db, line);
  if (conflict) {
    throw new BookingConflictError(
      "This homestay is no longer available for the selected date.",
    );
  }
}
