import { prisma } from "@/lib/prisma";

export type BookingType = "homestay" | "venue" | "edutrip";
export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "CHECKED_IN"
  | "COMPLETED"
  | "CANCELLED"
  | "REJECTED";

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

export class InvalidBookingTransitionError extends Error {}

export async function transitionBookingStatus(
  bookingType: BookingType,
  bookingId: string,
  nextStatus: BookingStatus,
) {
  const current = await findCurrentBookingStatus(bookingType, bookingId);
  if (!current) throw new InvalidBookingTransitionError("Booking not found");

  if (!ALLOWED_TRANSITIONS[current.bookingStatus].includes(nextStatus)) {
    throw new InvalidBookingTransitionError(
      `Cannot move booking from ${current.bookingStatus} to ${nextStatus}`,
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
      data: { bookingStatus: nextStatus },
    });
  }
  return prisma.transactionEdutrip.update({
    where: { id: bookingId },
    data: { bookingStatus: nextStatus },
  });
}
