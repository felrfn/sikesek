import { Prisma, type Holiday, type BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  generateInvoiceNumber,
  getHomestayNightlyRate,
  isDateClosedForBooking,
} from "@/lib/pricing";
import {
  getEdutripRentalWindow,
  getHomestayRentalWindow,
  getVenueRentalWindow,
} from "@/lib/bookingWindow";
import { paymentDeadlineFrom } from "@/lib/payment";
import { getTodayInJakarta } from "@/lib/siteConfig";
import type { CartItemInput, SubmitBookingInput } from "@/lib/validation/booking";

export class BookingError extends Error {}
export class BookingConflictError extends BookingError {}

// A booking in this set still "holds" the slot when its payment is still
// active. PENDING only holds until `paymentExpiresAt` - once that deadline
// passes, the slot is free again immediately even if the expiry job has not
// run yet (the job only has to clean up the payment/booking rows, not keep
// the calendar correct). CANCELLED/REJECTED bookings, and payments that
// ended FAILED/EXPIRED, never block availability.
const BLOCKING_BOOKING_STATUSES: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
];

function activePaymentFilter(now: Date): Prisma.TransactionWhereInput {
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
function stillHoldsSlot(now: Date, bookingStatus: BookingStatus, validUntil: Date) {
  return bookingStatus !== "COMPLETED" || now <= validUntil;
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
function stillHoldsVenueSlot(
  now: Date,
  bookingStatus: BookingStatus,
  validUntil: Date,
  checkedOutAt: Date | null,
) {
  if (bookingStatus !== "COMPLETED") return true;
  if (checkedOutAt) return false;
  return now <= validUntil;
}

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
  transactionHomestay: { findMany: (typeof prisma)["transactionHomestay"]["findMany"] };
  transactionVenue: { findMany: (typeof prisma)["transactionVenue"]["findMany"] };
  transactionEdutrip: { findMany: (typeof prisma)["transactionEdutrip"]["findMany"] };
}

async function findHomestayConflict(db: ConflictCheckClient, line: HomestayLine) {
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

function hourRangesOverlap(
  existingStartHour: number,
  existingEndHour: number,
  startHour: number,
  endHour: number,
) {
  return existingStartHour < endHour && existingEndHour > startHour;
}

async function findVenueConflict(db: ConflictCheckClient, line: VenueLine) {
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

/**
 * Edutrip is treated as one exclusive daily slot per package: one package can
 * only have one active booking per visit date (08:00-17:00 WIB). A PENDING
 * booking holds the slot until its payment deadline, exactly like the other
 * categories; a COMPLETED one keeps it until the fixed end of the day's
 * window (there is no per-booking checkout timestamp for edutrip).
 */
async function findEdutripConflict(db: ConflictCheckClient, line: EdutripLine) {
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

async function assertNoEdutripConflict(
  tx: Prisma.TransactionClient,
  line: EdutripLine,
) {
  const conflict = await findEdutripConflict(tx, line);
  if (conflict) {
    throw new BookingConflictError(
      "This Edutrip package is already booked for the selected date.",
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

      if (item.type === "edutrip") {
        const conflict = await findEdutripConflict(prisma, {
          packageId: item.id,
          visitDate: new Date(`${item.date}T00:00:00.000Z`),
          pax: item.pax,
          pricePerPax: 0n,
          subtotal: 0n,
        });
        if (conflict) {
          conflicts.push({
            index,
            message: "This Edutrip package is already booked for the selected date.",
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
          for (const line of edutripLines) {
            await assertNoEdutripConflict(tx, line);
          }

          return tx.transaction.create({
            data: {
              invoiceNumber,
              customerName: input.customer.name,
              customerEmail: input.customer.email,
              customerPhone: input.customer.phone,
              customerNote: input.customer.note,
              totalAmount,
              paymentExpiresAt: paymentDeadlineFrom(),
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
  /** `TransactionHomestay`/`TransactionVenue`/`TransactionEdutrip` id - pass this straight to `POST /api/mobile/bookings/checkout`. */
  bookingId: string;
  /** The visitor's name on this booking's transaction (`Transaction.customerName`). */
  customerName: string;
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
  unavailableReason: FacilityUnavailabilityReason | null,
): { status: FacilityAvailabilityStatus; reason: FacilityUnavailabilityReason | null } {
  if (!isActive) return { status: "UNAVAILABLE", reason: "INACTIVE" };
  if (closedForHoliday) return { status: "UNAVAILABLE", reason: "CLOSED_HOLIDAY" };
  if (unavailableReason) return { status: "UNAVAILABLE", reason: unavailableReason };
  return { status: "AVAILABLE", reason: null };
}

function resolveRentalStatus(
  now: Date,
  booking: { bookingId: string; customerName: string; validFrom: Date; validUntil: Date },
): FacilityRentalStatus {
  const { bookingId, customerName, validFrom, validUntil } = booking;
  const isExpired = now > validUntil;
  const isOccupied = !isExpired && now >= validFrom;
  return {
    isOccupied,
    bookingId,
    customerName,
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
 * at different points today), picks the one worth reporting, in order:
 *
 *  1. whichever window `now` actually falls inside (the active rental);
 *  2. otherwise the most recently *expired* one, so an overdue checkout is
 *     still surfaced rather than silently dropped;
 *  3. otherwise the earliest one that hasn't started yet.
 *
 * Case 3 matters because `CHECKED_IN` is set by a human (a QR scan, or an
 * admin force-checking someone in early via `adminCheckIn`) and is the real
 * signal that a visitor is physically present - it does not wait for the
 * nominal check-in hour. Dropping that case would return `rental: null` for
 * a facility that genuinely has someone in it, which hides the `bookingId`
 * the field officer needs to check them out at all.
 *
 * Two windows can't both contain `now` at once: the booking-conflict rules
 * already prevent two overlapping CHECKED_IN windows for the same facility.
 */
function pickRentalWindowToReport<T extends { validFrom: Date; validUntil: Date }>(
  now: Date,
  candidates: T[],
): T | undefined {
  const current = candidates.find((c) => now >= c.validFrom && now <= c.validUntil);
  if (current) return current;

  const expired = candidates.filter((c) => now > c.validUntil);
  if (expired.length > 0) {
    return expired.reduce((latest, c) => (c.validUntil > latest.validUntil ? c : latest));
  }

  const upcoming = candidates.filter((c) => now < c.validFrom);
  if (upcoming.length === 0) return undefined;
  return upcoming.reduce((earliest, c) => (c.validFrom < earliest.validFrom ? c : earliest));
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
 * is now the same kind of exclusive daily slot as homestay/venue (see its
 * `ALREADY_BOOKED` conflict below), so "occupied" applies to it as well.
 *
 * Homestay monitoring vs. booking truth are deliberately split: `status`/
 * `reason` (and every real booking-conflict check) use the exact-match
 * `checkInDate` rule, so a new night is never blocked or freed by this
 * endpoint's monitoring needs. `rental` additionally surfaces a CHECKED_IN
 * stay on its checkout day and while overdue past `endAt` (until COMPLETED),
 * so field officers can always find the `bookingId` they need to check out.
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

  const rangeIncludesToday =
    query.startDate <= todayKey && todayKey <= query.endDate;

  const [homestayConflicts, venueBookings, homestayMonitoring, edutripBookings] = await Promise.all([
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
    venues.length
      ? prisma.transactionVenue.findMany({
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
    // Edutrip is now treated as one exclusive daily slot per package, just
    // like homestay/venue. The same active-payment filter as every other
    // category keeps expired PENDING transactions, CANCELLED/REJECTED rows,
    // and completed slots past the day's fixed rental window out of the
    // booking/conflict logic.
    edutrips.length
      ? prisma.transactionEdutrip.findMany({
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
      : [],
  ]);

  const bookedHomestayByDate = new Set(
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
  type CheckedInWindow = { bookingId: string; customerName: string; validFrom: Date; validUntil: Date };

  // Monitoring candidates: every CHECKED_IN row relevant to today, deduped
  // by id (rows from `homestayConflicts` whose check-in falls in the range
  // plus rows from `homestayMonitoring` whose stay spills into/overdue past
  // today). A booking is attached to today's entry when its rental window
  // (getHomestayRentalWindow) touches the calendar day, OR when it is
  // already overdue (now > validUntil) and its stay has started - so a guest
  // who hasn't checked out stays actionable until someone completes them.
  const homestayCheckedInByDate = new Map<string, CheckedInWindow[]>();
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
      const windows = homestayCheckedInByDate.get(key) ?? [];
      windows.push({
        bookingId: row.id,
        customerName: row.transaction.customerName,
        validFrom,
        validUntil,
      });
      homestayCheckedInByDate.set(key, windows);
    }
  }

  const venueBookingsByDate = new Map<string, { startHour: number; endHour: number }[]>();
  const venueCheckedInByDate = new Map<string, CheckedInWindow[]>();
  for (const booking of venueBookings) {
    const key = `${booking.venueId}|${dateKeyOf(booking.bookingDate)}`;

    const blocks = stillHoldsVenueSlot(
      now,
      booking.bookingStatus,
      getVenueRentalWindow(booking.bookingDate, booking.startTime, booking.endTime).validUntil,
      booking.checkedOutAt,
    );
    if (blocks) {
      const hours = venueBookingsByDate.get(key) ?? [];
      hours.push({
        startHour: booking.startTime.getUTCHours(),
        endHour: booking.endTime.getUTCHours(),
      });
      venueBookingsByDate.set(key, hours);
    }

    if (booking.bookingStatus === "CHECKED_IN") {
      const windows = venueCheckedInByDate.get(key) ?? [];
      windows.push({
        bookingId: booking.id,
        customerName: booking.transaction.customerName,
        ...getVenueRentalWindow(booking.bookingDate, booking.startTime, booking.endTime),
      });
      venueCheckedInByDate.set(key, windows);
    }
  }

  const bookedEdutripByDate = new Set(
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
  const edutripCheckedInByDate = new Map<string, CheckedInWindow[]>();
  for (const booking of edutripBookings) {
    if (booking.bookingStatus !== "CHECKED_IN") continue;
    const key = `${booking.packageId}|${dateKeyOf(booking.visitDate)}`;
    const windows = edutripCheckedInByDate.get(key) ?? [];
    windows.push({
      bookingId: booking.id,
      customerName: booking.transaction.customerName,
      validFrom: getEdutripRentalWindow(booking.visitDate).validFrom,
      validUntil: getEdutripRentalWindow(booking.visitDate).validUntil,
    });
    edutripCheckedInByDate.set(key, windows);
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
        const active = pickRentalWindowToReport(
          now,
          homestayCheckedInByDate.get(key) ?? [],
        );
        if (active) rental = resolveRentalStatus(now, active);
      }
      facilities.push({
        id: homestay.id,
        category: "homestay",
        name: homestay.name,
        ...resolveAvailability(
          homestay.isActive,
          closedForHoliday,
          bookedHomestayByDate.has(key) ? "ALREADY_BOOKED" : null,
        ),
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
        const active = pickRentalWindowToReport(now, venueCheckedInByDate.get(key) ?? []);
        if (active) rental = resolveRentalStatus(now, active);
      }

      facilities.push({
        id: venue.id,
        category: "venue",
        name: venue.name,
        ...resolveAvailability(
          venue.isActive,
          closedForHoliday,
          hasTimeConflict ? "ALREADY_BOOKED" : null,
        ),
        rental,
      });
    }

    for (const pkg of edutrips) {
      const edutripKey = pkg.id + "|" + dateKey;
      let rental: FacilityRentalStatus | null = null;
      if (isToday) {
        const active = pickRentalWindowToReport(now, edutripCheckedInByDate.get(edutripKey) ?? []);
        if (active) rental = resolveRentalStatus(now, active);
      }

      facilities.push({
        id: pkg.id,
        category: "edutrip",
        name: pkg.name,
        ...resolveAvailability(
          pkg.isActive,
          closedForHoliday,
          bookedEdutripByDate.has(edutripKey) ? "ALREADY_BOOKED" : null,
        ),
        rental,
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
