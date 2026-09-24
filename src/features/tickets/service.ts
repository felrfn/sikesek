import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import {
  HOMESTAY_CHECK_IN_HOUR,
  HOMESTAY_CHECK_OUT_HOUR,
} from "@/lib/siteConfig";

export function generateTicketCode() {
  // Opaque, high-entropy, unguessable - this is what the QR encodes.
  // Never derived from or containing the invoice number or any other
  // customer-supplied/trusted data (PATTERNS.md ยง12).
  return `SK-${nanoid(24)}`;
}

function atHour(date: Date, hour: number) {
  const d = new Date(date);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function combineDateAndTime(date: Date, time: Date) {
  const d = new Date(date);
  d.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0, 0);
  return d;
}

/**
 * Creates one ticket per booked line item once payment is confirmed.
 * Idempotent - safe to call again for a transaction that already has
 * tickets (e.g. a retried webhook delivery), it just does nothing.
 */
export async function createTicketsForTransaction(transactionId: string) {
  const existingCount = await prisma.ticket.count({ where: { transactionId } });
  if (existingCount > 0) return;

  const transaction = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: { homestays: true, venues: true, edutrips: true },
  });

  const data: Prisma.TicketCreateManyInput[] = [
    ...transaction.homestays.map((h) => ({
      code: generateTicketCode(),
      transactionId,
      homestayBookingId: h.id,
      validFrom: atHour(h.checkInDate, HOMESTAY_CHECK_IN_HOUR),
      validUntil: atHour(h.checkOutDate, HOMESTAY_CHECK_OUT_HOUR),
    })),
    ...transaction.venues.map((v) => ({
      code: generateTicketCode(),
      transactionId,
      venueBookingId: v.id,
      validFrom: combineDateAndTime(v.bookingDate, v.startTime),
      validUntil: combineDateAndTime(v.bookingDate, v.endTime),
    })),
    ...transaction.edutrips.map((e) => ({
      code: generateTicketCode(),
      transactionId,
      edutripBookingId: e.id,
      validFrom: atHour(e.visitDate, 0),
      validUntil: atHour(e.visitDate, 23),
    })),
  ];

  if (data.length > 0) {
    await prisma.ticket.createMany({ data });
  }
}

const ticketInclude = {
  transaction: true,
  homestayBooking: { include: { homestay: true } },
  venueBooking: { include: { venue: true } },
  edutripBooking: { include: { package: true } },
} satisfies Prisma.TicketInclude;

type TicketWithRelations = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

export type TicketVerificationResult =
  | { status: "INVALID"; message: string }
  | { status: "PAYMENT_REQUIRED"; message: string; invoiceNumber: string }
  | { status: "CANCELLED"; message: string; invoiceNumber: string }
  | {
      status: "ALREADY_USED";
      message: string;
      usedAt: Date;
      invoiceNumber: string;
      facilityName: string;
    }
  | {
      status: "NOT_YET_VALID";
      message: string;
      validFrom: Date;
      invoiceNumber: string;
      facilityName: string;
    }
  | {
      status: "EXPIRED";
      message: string;
      expiredAt: Date;
      invoiceNumber: string;
      facilityName: string;
    }
  | {
      status: "VALID";
      message: string;
      invoiceNumber: string;
      customerName: string;
      facilityName: string;
      validFrom: Date;
      validUntil: Date;
      bookingType: "homestay" | "venue" | "edutrip";
      bookingId: string;
    };

function facilityNameOf(ticket: TicketWithRelations) {
  return (
    ticket.homestayBooking?.homestay.name ??
    ticket.venueBooking?.venue.name ??
    ticket.edutripBooking?.package.name ??
    "Unknown facility"
  );
}

function bookingOf(ticket: TicketWithRelations) {
  if (ticket.homestayBooking) {
    return { type: "homestay" as const, booking: ticket.homestayBooking };
  }
  if (ticket.venueBooking) {
    return { type: "venue" as const, booking: ticket.venueBooking };
  }
  if (ticket.edutripBooking) {
    return { type: "edutrip" as const, booking: ticket.edutripBooking };
  }
  return null;
}

/**
 * The authoritative ticket state machine. Every field the mobile app needs
 * to render a result is returned here - see docs/MOBILE_API.md.
 */
export async function verifyTicketCode(
  code: string,
): Promise<TicketVerificationResult> {
  const ticket = await prisma.ticket.findUnique({
    where: { code },
    include: ticketInclude,
  });

  if (!ticket) {
    return { status: "INVALID", message: "Ticket code not found." };
  }

  const invoiceNumber = ticket.transaction.invoiceNumber;

  if (ticket.transaction.paymentStatus !== "PAID") {
    return {
      status: "PAYMENT_REQUIRED",
      message: "Payment has not been confirmed for this booking yet.",
      invoiceNumber,
    };
  }

  const resolved = bookingOf(ticket);
  const facilityName = facilityNameOf(ticket);

  if (
    !resolved ||
    resolved.booking.bookingStatus === "CANCELLED" ||
    resolved.booking.bookingStatus === "REJECTED"
  ) {
    return {
      status: "CANCELLED",
      message: "This booking has been cancelled.",
      invoiceNumber,
    };
  }

  if (ticket.usedAt) {
    return {
      status: "ALREADY_USED",
      message: "This ticket has already been used.",
      usedAt: ticket.usedAt,
      invoiceNumber,
      facilityName,
    };
  }

  const now = new Date();
  if (now < ticket.validFrom) {
    return {
      status: "NOT_YET_VALID",
      message: "This ticket is not valid yet.",
      validFrom: ticket.validFrom,
      invoiceNumber,
      facilityName,
    };
  }
  if (now > ticket.validUntil) {
    return {
      status: "EXPIRED",
      message: "This ticket has expired.",
      expiredAt: ticket.validUntil,
      invoiceNumber,
      facilityName,
    };
  }

  return {
    status: "VALID",
    message: "Ticket is valid.",
    invoiceNumber,
    customerName: ticket.transaction.customerName,
    facilityName,
    validFrom: ticket.validFrom,
    validUntil: ticket.validUntil,
    bookingType: resolved.type,
    bookingId: resolved.booking.id,
  };
}

/**
 * Verifies AND consumes a ticket in one step (marks it used, transitions
 * the booking CONFIRMED -> CHECKED_IN). Only actually mutates state when
 * the ticket is VALID - every other outcome is read-only, so a mobile
 * client can safely call this directly for the scan flow.
 */
export async function consumeTicketByCode(
  code: string,
  verifiedByUserId: string,
): Promise<TicketVerificationResult> {
  const result = await verifyTicketCode(code);
  if (result.status !== "VALID") return result;

  await prisma.$transaction([
    prisma.ticket.update({
      where: { code },
      data: { usedAt: new Date(), usedByUserId: verifiedByUserId },
    }),
    updateBookingStatusQuery(result.bookingType, result.bookingId, "CHECKED_IN"),
  ]);

  return result;
}

function updateBookingStatusQuery(
  bookingType: "homestay" | "venue" | "edutrip",
  bookingId: string,
  status: "CHECKED_IN",
) {
  if (bookingType === "homestay") {
    return prisma.transactionHomestay.update({
      where: { id: bookingId },
      data: { bookingStatus: status },
    });
  }
  if (bookingType === "venue") {
    return prisma.transactionVenue.update({
      where: { id: bookingId },
      data: { bookingStatus: status },
    });
  }
  return prisma.transactionEdutrip.update({
    where: { id: bookingId },
    data: { bookingStatus: status },
  });
}
