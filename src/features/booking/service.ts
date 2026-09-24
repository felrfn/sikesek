import { Prisma, type PaymentStatus, type BookingStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber, getHomestayNightlyRate } from "@/lib/pricing";
import type { SubmitBookingInput } from "@/lib/validation/booking";

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

async function assertNoHomestayConflict(
  tx: Prisma.TransactionClient,
  line: HomestayLine,
) {
  const conflict = await tx.transactionHomestay.findFirst({
    where: {
      homestayId: line.homestayId,
      checkInDate: line.checkInDate,
      bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
      transaction: { paymentStatus: { in: BLOCKING_PAYMENT_STATUSES } },
    },
  });
  if (conflict) {
    throw new BookingConflictError(
      "This homestay is no longer available for the selected date.",
    );
  }
}

async function assertNoVenueConflict(tx: Prisma.TransactionClient, line: VenueLine) {
  const sameDayBookings = await tx.transactionVenue.findMany({
    where: {
      venueId: line.venueId,
      bookingDate: line.bookingDate,
      bookingStatus: { in: BLOCKING_BOOKING_STATUSES },
      transaction: { paymentStatus: { in: BLOCKING_PAYMENT_STATUSES } },
    },
  });

  const hasOverlap = sameDayBookings.some((existing) => {
    const existingStart = existing.startTime.getUTCHours();
    const existingEnd = existing.endTime.getUTCHours();
    return existingStart < line.endHour && existingEnd > line.startHour;
  });

  if (hasOverlap) {
    throw new BookingConflictError(
      "This meeting point is already booked for an overlapping time slot.",
    );
  }
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

  const [homestays, venues, edutrips] = await Promise.all([
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
  ]);

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
