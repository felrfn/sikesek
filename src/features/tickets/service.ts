import { prisma } from "@/lib/prisma";
import { getTransactionByInvoice } from "@/features/booking/service";

function isToday(date: Date) {
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

export async function validateTicket(invoiceNumber: string) {
  const transaction = await getTransactionByInvoice(invoiceNumber);

  if (!transaction) {
    return { valid: false as const, reason: "Invoice not found" };
  }
  if (transaction.paymentStatus !== "PAID") {
    return {
      valid: false as const,
      reason: `Payment status is ${transaction.paymentStatus}, not PAID`,
    };
  }

  const bookings = [
    ...transaction.homestays.map((h) => ({
      bookingType: "homestay" as const,
      bookingId: h.id,
      name: h.homestay.name,
      date: h.checkInDate,
      status: h.bookingStatus,
      dateValid: isToday(h.checkInDate),
    })),
    ...transaction.venues.map((v) => ({
      bookingType: "venue" as const,
      bookingId: v.id,
      name: v.venue.name,
      date: v.bookingDate,
      status: v.bookingStatus,
      dateValid: isToday(v.bookingDate),
    })),
    ...transaction.edutrips.map((e) => ({
      bookingType: "edutrip" as const,
      bookingId: e.id,
      name: e.package.name,
      date: e.visitDate,
      status: e.bookingStatus,
      dateValid: isToday(e.visitDate),
    })),
  ];

  return {
    valid: true as const,
    invoiceNumber: transaction.invoiceNumber,
    customerName: transaction.customerName,
    bookings,
  };
}

export type BookingType = "homestay" | "venue" | "edutrip";

async function findBooking(bookingType: BookingType, bookingId: string) {
  switch (bookingType) {
    case "homestay":
      return prisma.transactionHomestay.findUnique({ where: { id: bookingId } });
    case "venue":
      return prisma.transactionVenue.findUnique({ where: { id: bookingId } });
    case "edutrip":
      return prisma.transactionEdutrip.findUnique({ where: { id: bookingId } });
  }
}

async function updateBookingStatus(
  bookingType: BookingType,
  bookingId: string,
  status: "COMPLETED" | "CANCELLED" | "CONFIRMED",
) {
  switch (bookingType) {
    case "homestay":
      return prisma.transactionHomestay.update({
        where: { id: bookingId },
        data: { bookingStatus: status },
      });
    case "venue":
      return prisma.transactionVenue.update({
        where: { id: bookingId },
        data: { bookingStatus: status },
      });
    case "edutrip":
      return prisma.transactionEdutrip.update({
        where: { id: bookingId },
        data: { bookingStatus: status },
      });
  }
}

export async function checkInBooking(
  bookingType: BookingType,
  bookingId: string,
) {
  const current = await findBooking(bookingType, bookingId);

  if (!current) return { error: "Booking not found" as const };
  if (current.bookingStatus !== "CONFIRMED") {
    return {
      error: `Booking is ${current.bookingStatus}, expected CONFIRMED` as const,
    };
  }

  await updateBookingStatus(bookingType, bookingId, "COMPLETED");
  return { ok: true as const };
}
