import { prisma } from "@/lib/prisma";
import { getEdutripRentalWindow } from "@/lib/bookingWindow";
import {
  BLOCKING_BOOKING_STATUSES,
  activePaymentFilter,
  stillHoldsSlot,
} from "../categories/shared";
import { dateKeyOf } from "./status";
import type { CheckedInWindow } from "./types";

export interface EdutripAvailability {
  bookedKeys: Set<string>;
  checkedInByDate: Map<string, CheckedInWindow[]>;
}

export async function loadEdutripAvailability(params: {
  edutrips: { id: string }[];
  startDay: Date;
  endDay: Date;
  now: Date;
}): Promise<EdutripAvailability> {
  const { edutrips, startDay, endDay, now } = params;

  // Edutrip is now treated as one exclusive daily slot per package, just
  // like homestay/venue. The same active-payment filter as every other
  // category keeps expired PENDING transactions, CANCELLED/REJECTED rows,
  // and completed slots past the day's fixed rental window out of the
  // booking/conflict logic.
  const edutripBookings = edutrips.length
    ? await prisma.transactionEdutrip.findMany({
        where: {
          packageId: { in: edutrips.map((p) => p.id) },
          visitDate: { gte: startDay, lte: endDay },
          bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
          transaction: activePaymentFilter(now),
        },
        select: {
          id: true,
          packageId: true,
          visitDate: true,
          bookingStatus: true,
          transaction: { select: { customerName: true } },
        },
      })
    : [];

  const bookedKeys = new Set(
    edutripBookings
      .filter((booking) =>
        stillHoldsSlot(
          now,
          booking.bookingStatus,
          getEdutripRentalWindow(booking.visitDate).validUntil,
        ),
      )
      .map((booking) => `${booking.packageId}|${dateKeyOf(booking.visitDate)}`),
  );

  const checkedInByDate = new Map<string, CheckedInWindow[]>();
  for (const booking of edutripBookings) {
    if (booking.bookingStatus !== "CHECKED_IN") continue;
    const key = `${booking.packageId}|${dateKeyOf(booking.visitDate)}`;
    const windows = checkedInByDate.get(key) ?? [];
    windows.push({
      bookingId: booking.id,
      customerName: booking.transaction.customerName,
      validFrom: getEdutripRentalWindow(booking.visitDate).validFrom,
      validUntil: getEdutripRentalWindow(booking.visitDate).validUntil,
    });
    checkedInByDate.set(key, windows);
  }

  return { bookedKeys, checkedInByDate };
}
