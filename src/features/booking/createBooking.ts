import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber } from "@/lib/pricing";
import { paymentDeadlineFrom } from "@/lib/payment";
import type { SubmitBookingInput } from "@/lib/validation/booking";
import { BookingError, BookingConflictError } from "./errors";
import {
  assertNoEdutripConflict,
  buildEdutripLine,
  toEdutripCreateData,
  type EdutripLine,
} from "./categories/edutrip";
import {
  assertNoHomestayConflict,
  buildHomestayLine,
  toHomestayCreateData,
  type HomestayLine,
} from "./categories/homestay";
import { closedHolidayMessage } from "./categories/shared";
import {
  assertNoVenueConflict,
  buildVenueLine,
  toVenueCreateData,
  type VenueLine,
} from "./categories/venue";

/**
 * Recomputes every line item's price from the database rather than trusting
 * the client-submitted cart (RULES.md §2 - never trust client-supplied
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
      const line = buildHomestayLine(item, homestay, holidays);
      homestayLines.push(line);
      totalAmount += line.subtotal;
    }

    if (item.type === "venue") {
      const venue = venueMap.get(item.id);
      if (!venue) {
        throw new BookingError(`Venue ${item.id} is not available`);
      }
      const line = buildVenueLine(item, venue);
      venueLines.push(line);
      totalAmount += line.subtotal;
    }

    if (item.type === "edutrip") {
      const pkg = edutripMap.get(item.id);
      if (!pkg) {
        throw new BookingError(`Edutrip package ${item.id} is not available`);
      }
      const line = buildEdutripLine(item, pkg);
      edutripLines.push(line);
      totalAmount += line.subtotal;
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
                create: homestayLines.map((line) => toHomestayCreateData(line)),
              },
              venues: {
                create: venueLines.map((line) => toVenueCreateData(line)),
              },
              edutrips: {
                create: edutripLines.map((line) => toEdutripCreateData(line)),
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
