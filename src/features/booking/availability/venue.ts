import { prisma } from "@/lib/prisma";
import { getVenueRentalWindow } from "@/lib/bookingWindow";
import { stillHoldsVenueSlot } from "../categories/venue";
import { BLOCKING_BOOKING_STATUSES, activePaymentFilter } from "../categories/shared";
import { dateKeyOf } from "./status";
import type { CheckedInWindow } from "./types";

export interface VenueAvailability {
  bookingHoursByDate: Map<string, { startHour: number; endHour: number }[]>;
  checkedInByDate: Map<string, CheckedInWindow[]>;
}

export async function loadVenueAvailability(params: {
  venues: { id: string }[];
  startDay: Date;
  endDay: Date;
  now: Date;
}): Promise<VenueAvailability> {
  const { venues, startDay, endDay, now } = params;

  const venueBookings = venues.length
    ? await prisma.transactionVenue.findMany({
        where: {
          venueId: { in: venues.map((v) => v.id) },
          bookingDate: { gte: startDay, lte: endDay },
          bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
          transaction: activePaymentFilter(now),
        },
        select: {
          id: true,
          venueId: true,
          bookingDate: true,
          startTime: true,
          endTime: true,
          bookingStatus: true,
          checkedOutAt: true,
          transaction: { select: { customerName: true } },
        },
      })
    : [];

  const bookingHoursByDate = new Map<string, { startHour: number; endHour: number }[]>();
  const checkedInByDate = new Map<string, CheckedInWindow[]>();
  for (const booking of venueBookings) {
    const key = `${booking.venueId}|${dateKeyOf(booking.bookingDate)}`;

    const blocks = stillHoldsVenueSlot(
      now,
      booking.bookingStatus,
      getVenueRentalWindow(booking.bookingDate, booking.startTime, booking.endTime).validUntil,
      booking.checkedOutAt,
    );
    if (blocks) {
      const hours = bookingHoursByDate.get(key) ?? [];
      hours.push({
        startHour: booking.startTime.getUTCHours(),
        endHour: booking.endTime.getUTCHours(),
      });
      bookingHoursByDate.set(key, hours);
    }

    if (booking.bookingStatus === "CHECKED_IN") {
      const windows = checkedInByDate.get(key) ?? [];
      windows.push({
        bookingId: booking.id,
        customerName: booking.transaction.customerName,
        ...getVenueRentalWindow(booking.bookingDate, booking.startTime, booking.endTime),
      });
      checkedInByDate.set(key, windows);
    }
  }

  return { bookingHoursByDate, checkedInByDate };
}
