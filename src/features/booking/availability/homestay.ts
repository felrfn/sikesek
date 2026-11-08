import { prisma } from "@/lib/prisma";
import { getHomestayRentalWindow } from "@/lib/bookingWindow";
import {
  BLOCKING_BOOKING_STATUSES,
  activePaymentFilter,
  stillHoldsSlot,
} from "../categories/shared";
import { dateKeyOf } from "./status";
import type { CheckedInWindow } from "./types";

export interface HomestayAvailability {
  bookedKeys: Set<string>;
  checkedInByDate: Map<string, CheckedInWindow[]>;
}

export async function loadHomestayAvailability(params: {
  homestays: { id: string }[];
  startDay: Date;
  endDay: Date;
  now: Date;
  todayKey: string;
  rangeIncludesToday: boolean;
}): Promise<HomestayAvailability> {
  const { homestays, startDay, endDay, now, todayKey, rangeIncludesToday } = params;

  const [homestayConflicts, homestayMonitoring] = await Promise.all([
    homestays.length
      ? prisma.transactionHomestay.findMany({
          where: {
            homestayId: { in: homestays.map((h) => h.id) },
            checkInDate: { gte: startDay, lte: endDay },
            bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
            transaction: activePaymentFilter(now),
          },
          select: {
            id: true,
            homestayId: true,
            checkInDate: true,
            checkOutDate: true,
            bookingStatus: true,
            transaction: { select: { customerName: true } },
          },
        })
      : [],
    // Monitoring-only supplement for homestays: a CHECKED_IN guest is still
    // physically in the room on checkout day (and while overdue past it),
    // but their row's `checkInDate` equals the *previous* day, so the
    // booking-rule query above (exact `checkInDate` match) can never find
    // them when the queried date is the checkout day. This extra query
    // looks those rows up by `checkInDate <= endDay` instead of an exact
    // match. It feeds ONLY the `rental` field below - `status`/`reason`
    // (and every real booking-conflict check) still come exclusively from
    // `homestayConflicts`, so booking a new night is never blocked or freed
    // by this. COMPLETED rows are excluded by the status filter, so a
    // checked-out booking stops being reported. Skipped entirely when today
    // isn't in the range, since `rental` is only ever attached to today.
    homestays.length && rangeIncludesToday
      ? prisma.transactionHomestay.findMany({
          where: {
            homestayId: { in: homestays.map((h) => h.id) },
            checkInDate: { lte: endDay },
            bookingStatus: "CHECKED_IN",
            transaction: activePaymentFilter(now),
          },
          select: {
            id: true,
            homestayId: true,
            checkInDate: true,
            checkOutDate: true,
            bookingStatus: true,
            transaction: { select: { customerName: true } },
          },
        })
      : [],
  ]);

  const bookedKeys = new Set(
    homestayConflicts
      .filter((c) =>
        stillHoldsSlot(
          now,
          c.bookingStatus,
          getHomestayRentalWindow(c.checkInDate, c.checkOutDate).validUntil,
        ),
      )
      .map((c) => `${c.homestayId}|${dateKeyOf(c.checkInDate)}`),
  );

  // Monitoring candidates: every CHECKED_IN row relevant to today, deduped
  // by id (rows from `homestayConflicts` whose check-in falls in the range
  // plus rows from `homestayMonitoring` whose stay spills into/overdue past
  // today). A booking is attached to today's entry when its rental window
  // (getHomestayRentalWindow) touches the calendar day, OR when it is
  // already overdue (now > validUntil) and its stay has started - so a guest
  // who hasn't checked out stays actionable until someone completes them.
  const checkedInByDate = new Map<string, CheckedInWindow[]>();
  {
    const monitoringById = new Map<string, (typeof homestayConflicts)[number]>();
    for (const row of homestayConflicts) {
      if (row.bookingStatus !== "CHECKED_IN") continue;
      monitoringById.set(row.id, row);
    }
    for (const row of homestayMonitoring) {
      if (!monitoringById.has(row.id)) monitoringById.set(row.id, row);
    }
    const todayStart = new Date(`${todayKey}T00:00:00.000Z`).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000;
    for (const row of monitoringById.values()) {
      const { validFrom, validUntil } = getHomestayRentalWindow(
        row.checkInDate,
        row.checkOutDate,
      );
      const touchesToday =
        validFrom.getTime() < todayEnd && validUntil.getTime() > todayStart;
      const overdueCarry =
        now > validUntil && row.checkInDate.getTime() <= todayStart;
      if (!touchesToday && !overdueCarry) continue;
      const key = `${row.homestayId}|${todayKey}`;
      const windows = checkedInByDate.get(key) ?? [];
      windows.push({
        bookingId: row.id,
        customerName: row.transaction.customerName,
        validFrom,
        validUntil,
      });
      checkedInByDate.set(key, windows);
    }
  }

  return { bookedKeys, checkedInByDate };
}
