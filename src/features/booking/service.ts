import { Prisma, type Holiday, type PaymentStatus, type BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  generateInvoiceNumber,
  getHomestayNightlyRate,
  isDateClosedForBooking,
} from "@/lib/pricing";
import type {
  CartItemInput,
  FacilityAvailabilityQuery,
  SubmitBookingInput,
} from "@/lib/validation/booking";

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

export interface FacilityAvailability {
  id: string;
  category: FacilityCategoryName;
  name: string;
  status: FacilityAvailabilityStatus;
  reason: FacilityUnavailabilityReason | null;
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

/**
 * Availability for every facility (or just one category) on a given date,
 * for the mobile app (docs/MOBILE_API.md#facility-availability). Unlike
 * `checkAvailability` above - which checks a specific cart of items a
 * visitor is about to book - this enumerates the whole active catalog and
 * reports each facility's status, reusing the same blocking-status
 * constants and overlap predicate so "unavailable" means the same thing
 * here as it does at actual booking time.
 *
 * Runs a fixed, small number of queries (one findMany per facility
 * category, one batched conflict lookup per category) regardless of how
 * many facilities exist, rather than one conflict query per facility.
 *
 * `startHour`/`endHour` are optional for venues - without them, a venue is
 * only reported UNAVAILABLE for being inactive or holiday-closed, not for
 * a specific time-slot conflict (there's no single slot to check against).
 */
export async function getFacilityAvailability(
  query: FacilityAvailabilityQuery,
): Promise<FacilityAvailability[]> {
  const day = new Date(`${query.date}T00:00:00.000Z`);
  const holidays = await prisma.holiday.findMany();
  const closedForHoliday = isDateClosedForBooking(day, holidays);

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
            checkInDate: day,
            bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
            transaction: { paymentStatus: { in: BLOCKING_PAYMENT_STATUSES } },
          },
          select: { homestayId: true },
        })
      : [],
    venues.length
      ? prisma.transactionVenue.findMany({
          where: {
            venueId: { in: venues.map((v) => v.id) },
            bookingDate: day,
            bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
            transaction: { paymentStatus: { in: BLOCKING_PAYMENT_STATUSES } },
          },
          select: { venueId: true, startTime: true, endTime: true },
        })
      : [],
  ]);

  const bookedHomestayIds = new Set(homestayConflicts.map((c) => c.homestayId));

  const venueBookingsById = new Map<string, { startHour: number; endHour: number }[]>();
  for (const booking of venueBookings) {
    const existing = venueBookingsById.get(booking.venueId) ?? [];
    existing.push({
      startHour: booking.startTime.getUTCHours(),
      endHour: booking.endTime.getUTCHours(),
    });
    venueBookingsById.set(booking.venueId, existing);
  }

  const results: FacilityAvailability[] = [];

  for (const homestay of homestays) {
    results.push({
      id: homestay.id,
      category: "homestay",
      name: homestay.name,
      ...resolveAvailability(
        homestay.isActive,
        closedForHoliday,
        bookedHomestayIds.has(homestay.id),
      ),
    });
  }

  for (const venue of venues) {
    const hasTimeConflict =
      query.startHour !== undefined && query.endHour !== undefined
        ? (venueBookingsById.get(venue.id) ?? []).some((booked) =>
            hourRangesOverlap(booked.startHour, booked.endHour, query.startHour!, query.endHour!),
          )
        : false;
    results.push({
      id: venue.id,
      category: "venue",
      name: venue.name,
      ...resolveAvailability(venue.isActive, closedForHoliday, hasTimeConflict),
    });
  }

  for (const pkg of edutrips) {
    results.push({
      id: pkg.id,
      category: "edutrip",
      name: pkg.name,
      // Edutrip packages are pax-based, not exclusive - createBookingTransaction
      // never conflict-checks them either, so there's no ALREADY_BOOKED case here.
      ...resolveAvailability(pkg.isActive, closedForHoliday, false),
    });
  }

  return results;
}
