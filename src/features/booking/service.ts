import { Prisma, type Holiday, type PaymentStatus, type BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  generateInvoiceNumber,
  getHomestayNightlyRate,
  isDateClosedForBooking,
} from "@/lib/pricing";
import { getHomestayRentalWindow, getVenueRentalWindow } from "@/lib/bookingWindow";
import { getTodayInJakarta } from "@/lib/siteConfig";
import type { CartItemInput, SubmitBookingInput } from "@/lib/validation/booking";

export class BookingError extends Error {}
export class BookingConflictError extends BookingError {}

// A booking in this set still "holds" the slot - PENDING because payment
// might still complete, PAID because it's confirmed. CANCELLED/REJECTED
// bookings, and payments that ended FAILED/EXPIRED, never block availability.
const BLOCKING_PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "PAID"];
const BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
];

interface HomestayLine {
  homestayId: string;
  checkInDate: Date;
  checkOutDate: Date;
  pricePerNight: bigint;
  subtotal: bigint;
}
interface VenueLine {
  venueId: string;
  bookingDate: Date;
  startHour: number;
  endHour: number;
  pricePerHour: bigint;
  subtotal: bigint;
}
interface EdutripLine {
  packageId: string;
  visitDate: Date;
  pax: number;
  pricePerPax: bigint;
  subtotal: bigint;
}

function timeAt(hour: number) {
  return new Date(`1970-01-01T${String(hour).padStart(2, "0")}:00:00.000Z`);
}

// Both `prisma` (the plain client, used for the early advisory check on the
// booking page) and `tx` (an interactive transaction client, used for the
// authoritative check at commit time) satisfy this - only the read methods
// these conflict checks need are declared here.
interface ConflictCheckClient {
  transactionHomestay: { findFirst: (typeof prisma)["transactionHomestay"]["findFirst"] };
  transactionVenue: { findMany: (typeof prisma)["transactionVenue"]["findMany"] };
}

async function findHomestayConflict(db: ConflictCheckClient, line: HomestayLine) {
  return db.transactionHomestay.findFirst({
    where: {
      homestayId: line.homestayId,
      checkInDate: line.checkInDate,
      bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
      transaction: { paymentStatus: { in: BLOCKING_PAYMENT_STATUSES } },
    },
  });
}

function hourRangesOverlap(
  existingStartHour: number,
  existingEndHour: number,
  startHour: number,
  endHour: number,
) {
  return existingStartHour < endHour && existingEndHour > startHour;
}

async function findVenueConflict(db: ConflictCheckClient, line: VenueLine) {
  const sameDayBookings = await db.transactionVenue.findMany({
    where: {
      venueId: line.venueId,
      bookingDate: line.bookingDate,
      bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
      transaction: { paymentStatus: { in: BLOCKING_PAYMENT_STATUSES } },
    },
  });

  return sameDayBookings.find((existing) =>
    hourRangesOverlap(
      existing.startTime.getUTCHours(),
      existing.endTime.getUTCHours(),
      line.startHour,
      line.endHour,
    ),
  );
}

async function assertNoHomestayConflict(
  tx: Prisma.TransactionClient,
  line: HomestayLine,
) {
  const conflict = await findHomestayConflict(tx, line);
  if (conflict) {
    throw new BookingConflictError(
      "This homestay is no longer available for the selected date.",
    );
  }
}

async function assertNoVenueConflict(tx: Prisma.TransactionClient, line: VenueLine) {
  const conflict = await findVenueConflict(tx, line);
  if (conflict) {
    throw new BookingConflictError(
      "This meeting point is already booked for an overlapping time slot.",
    );
  }
}

export interface AvailabilityConflict {
  index: number;
  message: string;
}

function closedHolidayMessage(dateIso: string, holidays: Pick<Holiday, "date" | "isClosed">[]) {
  const date = new Date(`${dateIso}T00:00:00.000Z`);
  return isDateClosedForBooking(date, holidays)
    ? "This date is closed for bookings (holiday/maintenance)."
    : null;
}

/**
 * Advisory, read-only availability check for the booking (selection) page -
 * section 4/5's requirement that a conflict is surfaced *before* the user
 * reaches payment, not just at final submit. This is not a substitute for
 * the authoritative Serializable-transaction check inside
 * `createBookingTransaction` (a race between this check and the real one is
 * still possible and is what that second check is for) - it only improves
 * the common case's UX.
 */
export async function checkAvailability(
  items: CartItemInput[],
): Promise<AvailabilityConflict[]> {
  const conflicts: AvailabilityConflict[] = [];
  const holidays = await prisma.holiday.findMany();

  await Promise.all(
    items.map(async (item, index) => {
      const closedMessage = closedHolidayMessage(item.date, holidays);
      if (closedMessage) {
        conflicts.push({ index, message: closedMessage });
        return;
      }

      if (item.type === "homestay") {
        const checkIn = new Date(`${item.date}T00:00:00.000Z`);
        const conflict = await findHomestayConflict(prisma, {
          homestayId: item.id,
          checkInDate: checkIn,
          checkOutDate: checkIn,
          pricePerNight: 0n,
          subtotal: 0n,
        });
        if (conflict) {
          conflicts.push({
            index,
            message: "This homestay is already booked for the selected date.",
          });
        }
      }

      if (item.type === "venue") {
        const conflict = await findVenueConflict(prisma, {
          venueId: item.id,
          bookingDate: new Date(`${item.date}T00:00:00.000Z`),
          startHour: item.startHour,
          endHour: item.endHour,
          pricePerHour: 0n,
          subtotal: 0n,
        });
        if (conflict) {
          conflicts.push({
            index,
            message: "This meeting point is already booked for an overlapping time slot.",
          });
        }
      }
    }),
  );

  return conflicts.sort((a, b) => a.index - b.index);
}

/**
 * Recomputes every line item's price from the database rather than trusting
 * the client-submitted cart (RULES.md ยง2 - never trust client-supplied
 * prices), and re-checks availability at commit time inside a Serializable
 * transaction so two visitors racing to book the same slot can't both
 * succeed (section 4 - facility availability / conflict detection).
 */
export async function createBookingTransaction(input: SubmitBookingInput) {
  const homestayIds = input.items
    .filter((item) => item.type === "homestay")
    .map((item) => item.id);
  const venueIds = input.items
    .filter((item) => item.type === "venue")
    .map((item) => item.id);
  const edutripIds = input.items
    .filter((item) => item.type === "edutrip")
    .map((item) => item.id);

  const [homestays, venues, edutrips, holidays] = await Promise.all([
    homestayIds.length
      ? prisma.homestay.findMany({
          where: { id: { in: homestayIds }, isActive: true, deletedAt: null },
          include: { specialPrices: true },
        })
      : [],
    venueIds.length
      ? prisma.venue.findMany({
          where: { id: { in: venueIds }, isActive: true, deletedAt: null },
        })
      : [],
    edutripIds.length
      ? prisma.edutripPackage.findMany({
          where: { id: { in: edutripIds }, isActive: true, deletedAt: null },
        })
      : [],
    prisma.holiday.findMany(),
  ]);

  for (const item of input.items) {
    const closedMessage = closedHolidayMessage(item.date, holidays);
    if (closedMessage) throw new BookingConflictError(closedMessage);
  }

  const homestayMap = new Map(homestays.map((h) => [h.id, h]));
  const venueMap = new Map(venues.map((v) => [v.id, v]));
  const edutripMap = new Map(edutrips.map((e) => [e.id, e]));

  let totalAmount = 0n;
  const homestayLines: HomestayLine[] = [];
  const venueLines: VenueLine[] = [];
  const edutripLines: EdutripLine[] = [];

  for (const item of input.items) {
    if (item.type === "homestay") {
      const homestay = homestayMap.get(item.id);
      if (!homestay) {
        throw new BookingError(`Homestay ${item.id} is not available`);
      }
      const checkIn = new Date(`${item.date}T00:00:00.000Z`);
      const checkOut = new Date(checkIn.getTime() + 24 * 60 * 60 * 1000);
      const { amount } = getHomestayNightlyRate(
        homestay,
        checkIn,
        homestay.specialPrices,
        holidays,
      );
      homestayLines.push({
        homestayId: homestay.id,
        checkInDate: checkIn,
        checkOutDate: checkOut,
        pricePerNight: amount,
        subtotal: amount,
      });
      totalAmount += amount;
    }

    if (item.type === "venue") {
      const venue = venueMap.get(item.id);
      if (!venue) {
        throw new BookingError(`Venue ${item.id} is not available`);
      }
      const hours = item.endHour - item.startHour;
      const subtotal = venue.pricePerHour * BigInt(hours);
      venueLines.push({
        venueId: venue.id,
        bookingDate: new Date(`${item.date}T00:00:00.000Z`),
        startHour: item.startHour,
        endHour: item.endHour,
        pricePerHour: venue.pricePerHour,
        subtotal,
      });
      totalAmount += subtotal;
    }

    if (item.type === "edutrip") {
      const pkg = edutripMap.get(item.id);
      if (!pkg) {
        throw new BookingError(`Edutrip package ${item.id} is not available`);
      }
      const subtotal = pkg.pricePerPax * BigInt(item.pax);
      edutripLines.push({
        packageId: pkg.id,
        visitDate: new Date(`${item.date}T00:00:00.000Z`),
        pax: item.pax,
        pricePerPax: pkg.pricePerPax,
        subtotal,
      });
      totalAmount += subtotal;
    }
  }

  const invoiceNumber = generateInvoiceNumber();

  const MAX_ATTEMPTS = 3;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          for (const line of homestayLines) {
            await assertNoHomestayConflict(tx, line);
          }
          for (const line of venueLines) {
            await assertNoVenueConflict(tx, line);
          }

          return tx.transaction.create({
            data: {
              invoiceNumber,
              customerName: input.customer.name,
              customerEmail: input.customer.email,
              customerPhone: input.customer.phone,
              customerNote: input.customer.note,
              totalAmount,
              homestays: {
                create: homestayLines.map((line) => ({
                  homestayId: line.homestayId,
                  checkInDate: line.checkInDate,
                  checkOutDate: line.checkOutDate,
                  totalNights: 1,
                  pricePerNight: line.pricePerNight,
                  subtotal: line.subtotal,
                })),
              },
              venues: {
                create: venueLines.map((line) => ({
                  venueId: line.venueId,
                  bookingDate: line.bookingDate,
                  startTime: timeAt(line.startHour),
                  endTime: timeAt(line.endHour),
                  totalHours: line.endHour - line.startHour,
                  pricePerHour: line.pricePerHour,
                  subtotal: line.subtotal,
                })),
              },
              edutrips: {
                create: edutripLines.map((line) => ({
                  packageId: line.packageId,
                  visitDate: line.visitDate,
                  paxCount: line.pax,
                  pricePerPax: line.pricePerPax,
                  subtotal: line.subtotal,
                })),
              },
            },
          });
        },
        {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          // Neon's pooled connection string adds latency to acquiring a
          // connection for an interactive transaction - the 2s/5s Prisma
          // defaults are too tight for it in practice.
          maxWait: 10_000,
          timeout: 15_000,
        },
      );
    } catch (error) {
      const isSerializationFailure =
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2034";
      if (isSerializationFailure && attempt < MAX_ATTEMPTS) {
        continue;
      }
      throw error;
    }
  }

  throw new BookingError("Could not complete booking, please try again.");
}

export function getTransactionByInvoice(invoiceNumber: string) {
  return prisma.transaction.findUnique({
    where: { invoiceNumber },
    include: {
      homestays: { include: { homestay: true } },
      venues: { include: { venue: true } },
      edutrips: { include: { package: true } },
    },
  });
}

export type FacilityCategoryName = "homestay" | "venue" | "edutrip";
export type FacilityAvailabilityStatus = "AVAILABLE" | "UNAVAILABLE";
export type FacilityUnavailabilityReason = "INACTIVE" | "CLOSED_HOLIDAY" | "ALREADY_BOOKED";

/**
 * How much of a currently-occupied facility's rental period is left -
 * "occupied" meaning its blocking booking is `CHECKED_IN` *and* `now`
 * falls inside the same rental window `Ticket.validFrom`/`validUntil`
 * would be stamped with (src/lib/bookingWindow.ts). Only ever attached for
 * whichever date in the query is "today" (Asia/Jakarta) - a future date's
 * booking has no "remaining time" yet, and a past date's is moot.
 */
export interface FacilityRentalStatus {
  isOccupied: boolean;
  /** ISO 8601 - when this rental period started. */
  startAt: string;
  /** ISO 8601 - the authoritative checkout/expiration instant. */
  endAt: string;
  /** Seconds left until `endAt`, or `null` when not currently occupied. */
  remainingSeconds: number | null;
  /** `true` once `endAt` has passed, whether or not anyone has checked out yet. */
  isExpired: boolean;
}

export interface FacilityAvailability {
  id: string;
  category: FacilityCategoryName;
  name: string;
  status: FacilityAvailabilityStatus;
  reason: FacilityUnavailabilityReason | null;
  rental: FacilityRentalStatus | null;
}

export interface FacilityAvailabilityByDate {
  date: string;
  facilities: FacilityAvailability[];
}

export interface FacilityAvailabilityRangeQuery {
  startDate: string;
  endDate: string;
  category?: FacilityCategoryName;
  startHour?: number;
  endHour?: number;
}

function resolveAvailability(
  isActive: boolean,
  closedForHoliday: boolean,
  hasBookingConflict: boolean,
): { status: FacilityAvailabilityStatus; reason: FacilityUnavailabilityReason | null } {
  if (!isActive) return { status: "UNAVAILABLE", reason: "INACTIVE" };
  if (closedForHoliday) return { status: "UNAVAILABLE", reason: "CLOSED_HOLIDAY" };
  if (hasBookingConflict) return { status: "UNAVAILABLE", reason: "ALREADY_BOOKED" };
  return { status: "AVAILABLE", reason: null };
}

function resolveRentalStatus(
  now: Date,
  validFrom: Date,
  validUntil: Date,
): FacilityRentalStatus {
  const isExpired = now > validUntil;
  const isOccupied = !isExpired && now >= validFrom;
  return {
    isOccupied,
    startAt: validFrom.toISOString(),
    endAt: validUntil.toISOString(),
    remainingSeconds: isOccupied
      ? Math.max(0, Math.round((validUntil.getTime() - now.getTime()) / 1000))
      : null,
    isExpired,
  };
}

function dateKeyOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Of a CHECKED_IN booking's possibly-several rental windows for one
 * facility on one day (e.g. two non-overlapping venue slots both checked in
 * at different points today), picks whichever one `now` actually falls
 * inside; if none is currently active, falls back to the most recently
 * *expired* one so an overdue checkout is still surfaced (reason requires
 * this - "handle expired bookings correctly" - never silently drop it).
 * Two windows can't both contain `now` at once: the booking-conflict rules
 * already prevent two overlapping CHECKED_IN windows for the same facility.
 */
function pickCurrentOrMostRecentlyExpired<T extends { validFrom: Date; validUntil: Date }>(
  now: Date,
  candidates: T[],
): T | undefined {
  const current = candidates.find((c) => now >= c.validFrom && now <= c.validUntil);
  if (current) return current;
  const expired = candidates.filter((c) => now > c.validUntil);
  if (expired.length === 0) return undefined;
  return expired.reduce((latest, c) => (c.validUntil > latest.validUntil ? c : latest));
}

/**
 * Availability for every facility (or just one category) across a date
 * range `[startDate, endDate]` (inclusive) - the core the mobile app's
 * `facilities/availability` endpoint is built on
 * (docs/MOBILE_API.md#facility-availability). `getFacilityAvailability`
 * below is a thin single-day wrapper over this, so a single-date query and
 * a range query can never drift into two different definitions of
 * "available" - reusing the exact same blocking-status constants and
 * overlap predicate `checkAvailability`/`createBookingTransaction` use, so
 * "unavailable" means the same thing here as it does at actual booking
 * time.
 *
 * Runs a fixed, small number of queries regardless of how many days or
 * facilities are involved: one `findMany` per facility category, one
 * batched conflict lookup per category covering the *entire* range at
 * once (not one query per day), grouped back out per day in memory.
 *
 * For whichever date in the range is "today" (Asia/Jakarta), a homestay or
 * venue currently blocked by a `CHECKED_IN` booking also gets a `rental`
 * block, computed fresh from that booking's own dates via
 * `getHomestayRentalWindow`/`getVenueRentalWindow` (src/lib/bookingWindow.ts)
 * rather than by reading `Ticket.validFrom`/`validUntil` off a joined
 * Ticket row - an admin can force a booking to `CHECKED_IN` with no Ticket
 * at all (see `adminCheckIn`), so deriving the window from the booking
 * itself is both more efficient (no extra join) and correct in that case
 * too. `rental` is `null` for every other day/facility/category - edutrip
 * packages are pax-based, not an exclusive slot (see `resolveAvailability`'s
 * edutrip call below), so "occupied" doesn't apply to them either.
 *
 * `startHour`/`endHour` are optional for venues - without them, a venue's
 * `status`/`reason` only reflects being inactive or holiday-closed, not a
 * specific time-slot conflict (there's no single slot to check against);
 * `rental` is unaffected either way, since it reflects the booking's own
 * recorded time, not the query's filter.
 */
export async function getFacilityAvailabilityRange(
  query: FacilityAvailabilityRangeQuery,
): Promise<FacilityAvailabilityByDate[]> {
  const startDay = new Date(`${query.startDate}T00:00:00.000Z`);
  const endDay = new Date(`${query.endDate}T00:00:00.000Z`);
  const now = new Date();
  const todayKey = getTodayInJakarta();

  const holidays = await prisma.holiday.findMany();

  const includeHomestay = !query.category || query.category === "homestay";
  const includeVenue = !query.category || query.category === "venue";
  const includeEdutrip = !query.category || query.category === "edutrip";

  const [homestays, venues, edutrips] = await Promise.all([
    includeHomestay
      ? prisma.homestay.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true },
        })
      : [],
    includeVenue
      ? prisma.venue.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true },
        })
      : [],
    includeEdutrip
      ? prisma.edutripPackage.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true },
        })
      : [],
  ]);

  const [homestayConflicts, venueBookings] = await Promise.all([
    homestays.length
      ? prisma.transactionHomestay.findMany({
          where: {
            homestayId: { in: homestays.map((h) => h.id) },
            checkInDate: { gte: startDay, lte: endDay },
            bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
            transaction: { paymentStatus: { in: BLOCKING_PAYMENT_STATUSES } },
          },
          select: { homestayId: true, checkInDate: true, checkOutDate: true, bookingStatus: true },
        })
      : [],
    venues.length
      ? prisma.transactionVenue.findMany({
          where: {
            venueId: { in: venues.map((v) => v.id) },
            bookingDate: { gte: startDay, lte: endDay },
            bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
            transaction: { paymentStatus: { in: BLOCKING_PAYMENT_STATUSES } },
          },
          select: {
            venueId: true,
            bookingDate: true,
            startTime: true,
            endTime: true,
            bookingStatus: true,
          },
        })
      : [],
  ]);

  const bookedHomestayByDate = new Set(
    homestayConflicts.map((c) => `${c.homestayId}|${dateKeyOf(c.checkInDate)}`),
  );
  const homestayCheckedInByDate = new Map<string, { validFrom: Date; validUntil: Date }[]>();
  for (const conflict of homestayConflicts) {
    if (conflict.bookingStatus !== "CHECKED_IN") continue;
    const key = `${conflict.homestayId}|${dateKeyOf(conflict.checkInDate)}`;
    const windows = homestayCheckedInByDate.get(key) ?? [];
    windows.push(getHomestayRentalWindow(conflict.checkInDate, conflict.checkOutDate));
    homestayCheckedInByDate.set(key, windows);
  }

  const venueBookingsByDate = new Map<string, { startHour: number; endHour: number }[]>();
  const venueCheckedInByDate = new Map<string, { validFrom: Date; validUntil: Date }[]>();
  for (const booking of venueBookings) {
    const key = `${booking.venueId}|${dateKeyOf(booking.bookingDate)}`;

    const hours = venueBookingsByDate.get(key) ?? [];
    hours.push({
      startHour: booking.startTime.getUTCHours(),
      endHour: booking.endTime.getUTCHours(),
    });
    venueBookingsByDate.set(key, hours);

    if (booking.bookingStatus === "CHECKED_IN") {
      const windows = venueCheckedInByDate.get(key) ?? [];
      windows.push(getVenueRentalWindow(booking.bookingDate, booking.startTime, booking.endTime));
      venueCheckedInByDate.set(key, windows);
    }
  }

  const results: FacilityAvailabilityByDate[] = [];

  for (
    const day = new Date(startDay);
    day.getTime() <= endDay.getTime();
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const dateKey = dateKeyOf(day);
    const closedForHoliday = isDateClosedForBooking(day, holidays);
    const isToday = dateKey === todayKey;
    const facilities: FacilityAvailability[] = [];

    for (const homestay of homestays) {
      const key = `${homestay.id}|${dateKey}`;
      let rental: FacilityRentalStatus | null = null;
      if (isToday) {
        const active = pickCurrentOrMostRecentlyExpired(
          now,
          homestayCheckedInByDate.get(key) ?? [],
        );
        if (active) rental = resolveRentalStatus(now, active.validFrom, active.validUntil);
      }
      facilities.push({
        id: homestay.id,
        category: "homestay",
        name: homestay.name,
        ...resolveAvailability(homestay.isActive, closedForHoliday, bookedHomestayByDate.has(key)),
        rental,
      });
    }

    for (const venue of venues) {
      const key = `${venue.id}|${dateKey}`;
      const hasTimeConflict =
        query.startHour !== undefined && query.endHour !== undefined
          ? (venueBookingsByDate.get(key) ?? []).some((booked) =>
              hourRangesOverlap(booked.startHour, booked.endHour, query.startHour!, query.endHour!),
            )
          : false;

      let rental: FacilityRentalStatus | null = null;
      if (isToday) {
        const active = pickCurrentOrMostRecentlyExpired(now, venueCheckedInByDate.get(key) ?? []);
        if (active) rental = resolveRentalStatus(now, active.validFrom, active.validUntil);
      }

      facilities.push({
        id: venue.id,
        category: "venue",
        name: venue.name,
        ...resolveAvailability(venue.isActive, closedForHoliday, hasTimeConflict),
        rental,
      });
    }

    for (const pkg of edutrips) {
      facilities.push({
        id: pkg.id,
        category: "edutrip",
        name: pkg.name,
        // Edutrip packages are pax-based, not exclusive - createBookingTransaction
        // never conflict-checks them either, so there's no ALREADY_BOOKED/occupied
        // case here.
        ...resolveAvailability(pkg.isActive, closedForHoliday, false),
        rental: null,
      });
    }

    results.push({ date: dateKey, facilities });
  }

  return results;
}

/**
 * Single-day convenience wrapper over `getFacilityAvailabilityRange` - kept
 * so a single-`date` query keeps returning the exact flat `facilities`
 * array it always has (no response-shape change for existing callers).
 */
export async function getFacilityAvailability(query: {
  date: string;
  category?: FacilityCategoryName;
  startHour?: number;
  endHour?: number;
}): Promise<FacilityAvailability[]> {
  const [day] = await getFacilityAvailabilityRange({
    startDate: query.date,
    endDate: query.date,
    category: query.category,
    startHour: query.startHour,
    endHour: query.endHour,
  });
  return day.facilities;
}
