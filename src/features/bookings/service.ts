import { prisma } from "@/lib/prisma";
import { logAudit, type AuditActor } from "@/lib/audit";
import { formatCurrency } from "@/lib/utils/format";
import {
  addDaysKey,
  dateToKey,
  groupAndMergeBookings,
  type RawScheduleBooking,
  type ScheduleBooking,
  type ScheduleFacility,
  type ScheduleHoliday,
} from "./schedule";

export type BookingType = "homestay" | "venue" | "edutrip";
export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

export interface BookingScheduleStats {
  total: number;
  confirmed: number;
  pending: number;
}

export interface BookingScheduleResult {
  facilities: ScheduleFacility[];
  bookings: ScheduleBooking[];
  holidays: ScheduleHoliday[];
  stats: BookingScheduleStats;
}

export interface UnifiedBookingRow {
  bookingId: string;
  transactionId: string;
  bookingType: BookingType;
  invoiceNumber: string;
  visitorName: string;
  facilityName: string;
  date: Date;
  timeLabel: string;
  paymentStatus: string;
  bookingStatus: string;
}

export async function getUnifiedBookings(): Promise<UnifiedBookingRow[]> {
  const [homestays, venues, edutrips] = await Promise.all([
    prisma.transactionHomestay.findMany({
      include: { homestay: true, transaction: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transactionVenue.findMany({
      include: { venue: true, transaction: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.transactionEdutrip.findMany({
      include: { package: true, transaction: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rows: UnifiedBookingRow[] = [
    ...homestays.map((h) => ({
      bookingId: h.id,
      transactionId: h.transactionId,
      bookingType: "homestay" as const,
      invoiceNumber: h.transaction.invoiceNumber,
      visitorName: h.transaction.customerName,
      facilityName: h.homestay.name,
      date: h.checkInDate,
      timeLabel: `${h.totalNights} night(s)`,
      paymentStatus: h.transaction.paymentStatus,
      bookingStatus: h.bookingStatus,
    })),
    ...venues.map((v) => ({
      bookingId: v.id,
      transactionId: v.transactionId,
      bookingType: "venue" as const,
      invoiceNumber: v.transaction.invoiceNumber,
      visitorName: v.transaction.customerName,
      facilityName: v.venue.name,
      date: v.bookingDate,
      timeLabel: `${v.totalHours}h`,
      paymentStatus: v.transaction.paymentStatus,
      bookingStatus: v.bookingStatus,
    })),
    ...edutrips.map((e) => ({
      bookingId: e.id,
      transactionId: e.transactionId,
      bookingType: "edutrip" as const,
      invoiceNumber: e.transaction.invoiceNumber,
      visitorName: e.transaction.customerName,
      facilityName: e.package.name,
      date: e.visitDate,
      timeLabel: `${e.paxCount} pax`,
      paymentStatus: e.transaction.paymentStatus,
      bookingStatus: e.bookingStatus,
    })),
  ];

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}

/**
 * Everything the admin Gantt chart needs for one booking type in one visible
 * date range: the bookable units (as rows), their bookings, and any holidays
 * worth shading. Pure position/lane/merge maths lives in `schedule.ts`; this
 * function only does I/O and normalizes Prisma rows into that shape.
 *
 * Dates are WIB calendar dates. `fromKey`/`toKey` are inclusive `YYYY-MM-DD`
 * keys; booking columns are `@db.Date`, so UTC midnights compare correctly.
 */
export async function getBookingSchedule(params: {
  bookingType: BookingType;
  fromKey: string;
  toKey: string;
}): Promise<BookingScheduleResult> {
  const { bookingType, fromKey, toKey } = params;
  const from = new Date(`${fromKey}T00:00:00.000Z`);
  const toInclusive = new Date(`${toKey}T00:00:00.000Z`);
  const toExclusive = new Date(`${addDaysKey(toKey, 1)}T00:00:00.000Z`);
  const now = new Date();

  const transactionSelect = {
    select: {
      invoiceNumber: true,
      customerName: true,
      paymentStatus: true,
      paymentExpiresAt: true,
    },
  } as const;

  let raw: RawScheduleBooking[] = [];

  if (bookingType === "homestay") {
    const rows = await prisma.transactionHomestay.findMany({
      where: {
        checkInDate: { lt: toExclusive },
        checkOutDate: { gt: from },
      },
      select: {
        id: true,
        transactionId: true,
        homestayId: true,
        bookingStatus: true,
        checkInDate: true,
        checkOutDate: true,
        totalNights: true,
        transaction: transactionSelect,
      },
    });

    raw = rows.map((row) => ({
      bookingId: row.id,
      transactionId: row.transactionId,
      bookingType: "homestay" as const,
      facilityId: row.homestayId,
      customerName: row.transaction.customerName,
      invoiceNumber: row.transaction.invoiceNumber,
      bookingStatus: row.bookingStatus,
      paymentStatus: row.transaction.paymentStatus,
      paymentOverdue: isPaymentOverdue(row.transaction, now),
      startKey: dateToKey(row.checkInDate),
      endKey: dateToKey(row.checkOutDate),
      nights: row.totalNights,
    }));
  } else if (bookingType === "venue") {
    const rows = await prisma.transactionVenue.findMany({
      where: { bookingDate: { gte: from, lte: toInclusive } },
      select: {
        id: true,
        transactionId: true,
        venueId: true,
        bookingStatus: true,
        bookingDate: true,
        startTime: true,
        endTime: true,
        totalHours: true,
        transaction: transactionSelect,
      },
    });

    raw = rows.map((row) => {
      const startHour = row.startTime.getUTCHours();
      // 24:00 end times round-trip through `@db.Time` as 00:00, which would
      // otherwise read as an end before the start. `totalHours` is the
      // authoritative duration, so use it as the fallback.
      const rawEnd = row.endTime.getUTCHours();
      const endHour =
        rawEnd > startHour ? rawEnd : Math.min(24, startHour + row.totalHours);

      return {
        bookingId: row.id,
        transactionId: row.transactionId,
        bookingType: "venue" as const,
        facilityId: row.venueId,
        customerName: row.transaction.customerName,
        invoiceNumber: row.transaction.invoiceNumber,
        bookingStatus: row.bookingStatus,
        paymentStatus: row.transaction.paymentStatus,
        paymentOverdue: isPaymentOverdue(row.transaction, now),
        startKey: dateToKey(row.bookingDate),
        endKey: dateToKey(row.bookingDate),
        startHour,
        endHour,
      };
    });
  } else {
    const rows = await prisma.transactionEdutrip.findMany({
      where: { visitDate: { gte: from, lte: toInclusive } },
      select: {
        id: true,
        transactionId: true,
        packageId: true,
        bookingStatus: true,
        visitDate: true,
        paxCount: true,
        transaction: transactionSelect,
      },
    });

    raw = rows.map((row) => ({
      bookingId: row.id,
      transactionId: row.transactionId,
      bookingType: "edutrip" as const,
      facilityId: row.packageId,
      customerName: row.transaction.customerName,
      invoiceNumber: row.transaction.invoiceNumber,
      bookingStatus: row.bookingStatus,
      paymentStatus: row.transaction.paymentStatus,
      paymentOverdue: isPaymentOverdue(row.transaction, now),
      startKey: dateToKey(row.visitDate),
      endKey: addDaysKey(dateToKey(row.visitDate), 1),
      pax: row.paxCount,
    }));
  }

  const bookedFacilityIds = [...new Set(raw.map((row) => row.facilityId))];

  const [facilities, holidays] = await Promise.all([
    loadScheduleFacilities(bookingType, bookedFacilityIds),
    prisma.holiday.findMany({
      where: { date: { gte: from, lte: toInclusive } },
      select: { date: true, name: true, isClosed: true },
      orderBy: { date: "asc" },
    }),
  ]);

  const bookings = groupAndMergeBookings(raw);

  // A merged bar is one stay/booking from the admin's point of view (three
  // contiguous nights are one reservation, not three).
  const countable = bookings.filter(
    (booking) =>
      booking.bookingStatus !== "CANCELLED" && booking.bookingStatus !== "REJECTED",
  );

  return {
    facilities,
    bookings,
    holidays: holidays.map((holiday) => ({
      dateKey: dateToKey(holiday.date),
      name: holiday.name,
      isClosed: holiday.isClosed,
    })),
    stats: {
      total: countable.length,
      confirmed: countable.filter((booking) => booking.bookingStatus === "CONFIRMED")
        .length,
      pending: countable.filter((booking) => booking.bookingStatus === "PENDING").length,
    },
  };
}

function isPaymentOverdue(
  transaction: { paymentStatus: string; paymentExpiresAt: Date | null },
  now: Date,
) {
  return (
    transaction.paymentStatus === "PENDING" &&
    transaction.paymentExpiresAt !== null &&
    transaction.paymentExpiresAt.getTime() <= now.getTime()
  );
}

async function loadScheduleFacilities(
  bookingType: BookingType,
  bookedFacilityIds: string[],
): Promise<ScheduleFacility[]> {
  // Active units are always shown (an empty row means "free"), plus any unit
  // that has a booking in the range even if it has since been deactivated.
  const referenced =
    bookedFacilityIds.length > 0 ? [{ id: { in: bookedFacilityIds } }] : [];
  const visible = { deletedAt: null, isActive: true };
  const where = { OR: [visible, ...referenced] };

  if (bookingType === "homestay") {
    const rows = await prisma.homestay.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        roomCount: true,
        bedCount: true,
        maxCapacity: true,
        isActive: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      meta: `${row.roomCount} kamar · ${row.bedCount} bed · maks ${row.maxCapacity} org`,
      isActive: row.isActive,
    }));
  }

  if (bookingType === "venue") {
    const rows = await prisma.venue.findMany({
      where,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        maxCapacity: true,
        pricePerHour: true,
        isActive: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      meta: `${formatCurrency(row.pricePerHour)}/jam · maks ${row.maxCapacity} org`,
      isActive: row.isActive,
    }));
  }

  const rows = await prisma.edutripPackage.findMany({
    where,
    orderBy: { name: "asc" },
    select: { id: true, name: true, pricePerPax: true, isActive: true },
  });
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    meta: `${formatCurrency(row.pricePerPax)}/pax`,
    isActive: row.isActive,
  }));
}

function findCurrentBookingStatus(bookingType: BookingType, bookingId: string) {
  if (bookingType === "homestay") {
    return prisma.transactionHomestay.findUnique({
      where: { id: bookingId },
      select: { bookingStatus: true },
    });
  }
  if (bookingType === "venue") {
    return prisma.transactionVenue.findUnique({
      where: { id: bookingId },
      select: { bookingStatus: true },
    });
  }
  return prisma.transactionEdutrip.findUnique({
    where: { id: bookingId },
    select: { bookingStatus: true },
  });
}

export async function getBookingDetail(bookingType: BookingType, bookingId: string) {
  if (bookingType === "homestay") {
    return prisma.transactionHomestay.findUnique({
      where: { id: bookingId },
      include: { homestay: true, transaction: true, ticket: true },
    });
  }
  if (bookingType === "venue") {
    return prisma.transactionVenue.findUnique({
      where: { id: bookingId },
      include: { venue: true, transaction: true, ticket: true },
    });
  }
  return prisma.transactionEdutrip.findUnique({
    where: { id: bookingId },
    include: { package: true, transaction: true, ticket: true },
  });
}

// Admin-facing lifecycle transitions, independent of payment status
// (RULES.md ยง6, and the product owner's explicit instruction that admins
// must not arbitrarily change payment status - only Midtrans webhook
// processing does that). CHECKED_IN is normally reached via ticket
// verification (features/tickets/service.ts consumeTicketByCode), not this
// path, but an admin can still do it manually at the front desk.
const ALLOWED_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED", "REJECTED"],
  CONFIRMED: ["CHECKED_IN", "CANCELLED", "REJECTED"],
  CHECKED_IN: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
  REJECTED: [],
};

/**
 * `reason` lets callers (e.g. the mobile checkout endpoint) pick the right
 * HTTP status/error code without parsing `message` - "not found" and "not
 * a valid transition from the current state" are different failure modes
 * even though both throw this same error class.
 */
export class InvalidBookingTransitionError extends Error {
  reason: "NOT_FOUND" | "INVALID_TRANSITION";

  constructor(message: string, reason: "NOT_FOUND" | "INVALID_TRANSITION") {
    super(message);
    this.reason = reason;
  }
}

export async function transitionBookingStatus(
  bookingType: BookingType,
  bookingId: string,
  nextStatus: BookingStatus,
) {
  const current = await findCurrentBookingStatus(bookingType, bookingId);
  if (!current) throw new InvalidBookingTransitionError("Booking not found", "NOT_FOUND");

  if (!ALLOWED_TRANSITIONS[current.bookingStatus].includes(nextStatus)) {
    throw new InvalidBookingTransitionError(
      `Cannot move booking from ${current.bookingStatus} to ${nextStatus}`,
      "INVALID_TRANSITION",
    );
  }

  if (bookingType === "homestay") {
    return prisma.transactionHomestay.update({
      where: { id: bookingId },
      data: { bookingStatus: nextStatus },
    });
  }
  if (bookingType === "venue") {
    return prisma.transactionVenue.update({
      where: { id: bookingId },
      // checkedOutAt is the real checkout instant, independent of the
      // booking's scheduled endTime - it's what lets venue availability
      // release an early checkout's slot immediately instead of waiting
      // for the original end time (src/features/booking/categories/venue.ts's
      // stillHoldsVenueSlot). Only ever set here, atomically with the
      // CHECKED_IN -> COMPLETED transition itself, so "checkout officially
      // confirmed" and "checkedOutAt recorded" can never disagree.
      data: {
        bookingStatus: nextStatus,
        ...(nextStatus === "COMPLETED" ? { checkedOutAt: new Date() } : {}),
      },
    });
  }
  return prisma.transactionEdutrip.update({
    where: { id: bookingId },
    data: { bookingStatus: nextStatus },
  });
}

const AUDIT_ENTITY_TYPE_BY_BOOKING_TYPE: Record<BookingType, string> = {
  homestay: "TransactionHomestay",
  venue: "TransactionVenue",
  edutrip: "TransactionEdutrip",
};

export interface CheckoutResult {
  bookingId: string;
  bookingType: BookingType;
  status: "COMPLETED";
  facilityName: string;
}

/**
 * A field officer ends a visitor's on-site stay/usage ("checkout" - mobile
 * app, docs/MOBILE_API.md#booking-checkout). This is the exact same
 * CHECKED_IN -> COMPLETED transition the web admin's `completeBooking`
 * already performs (`transitionBookingStatus` above) - duplicate/invalid
 * checkout is prevented the same way any other invalid transition is, by
 * `ALLOWED_TRANSITIONS` rejecting anything that isn't currently
 * `CHECKED_IN`. The only thing specific to this entrypoint is attributing
 * the action to the officer who performed it, via the same `logAudit`
 * mechanism every other auditable mutation in this codebase uses.
 *
 * For venue bookings, `transitionBookingStatus` also stamps
 * `TransactionVenue.checkedOutAt` as part of this same transition - that
 * column (not the audit log, which is fire-and-forget and swallows its own
 * failures - see `logAudit`) is the authoritative record venue availability
 * reads to release an early checkout's slot immediately.
 */
export async function checkoutBooking(
  bookingType: BookingType,
  bookingId: string,
  actor: AuditActor,
): Promise<CheckoutResult> {
  await transitionBookingStatus(bookingType, bookingId, "COMPLETED");

  const detail = await getBookingDetail(bookingType, bookingId);
  const facilityName = detail
    ? "homestay" in detail
      ? detail.homestay.name
      : "venue" in detail
        ? detail.venue.name
        : detail.package.name
    : undefined;

  await logAudit({
    actor,
    action: `${bookingType}.checked_out`,
    entityType: AUDIT_ENTITY_TYPE_BY_BOOKING_TYPE[bookingType],
    entityId: bookingId,
    metadata: { facilityName: facilityName ?? null },
  });

  return { bookingId, bookingType, status: "COMPLETED", facilityName: facilityName ?? "" };
}
