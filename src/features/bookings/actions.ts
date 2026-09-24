"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  InvalidBookingTransitionError,
  transitionBookingStatus,
  type BookingType,
} from "@/features/bookings/service";
import { consumeTicketByCode } from "@/features/tickets/service";
import { prisma } from "@/lib/prisma";

async function runTransition(
  bookingType: BookingType,
  bookingId: string,
  nextStatus: "CONFIRMED" | "CHECKED_IN" | "COMPLETED" | "CANCELLED" | "REJECTED",
) {
  await requireAdmin();
  try {
    await transitionBookingStatus(bookingType, bookingId, nextStatus);
    revalidatePath("/admin/bookings");
    return {};
  } catch (error) {
    if (error instanceof InvalidBookingTransitionError) {
      return { error: error.message };
    }
    return { error: "Could not update booking status." };
  }
}

export async function confirmBooking(t: BookingType, id: string) {
  return runTransition(t, id, "CONFIRMED");
}
export async function completeBooking(t: BookingType, id: string) {
  return runTransition(t, id, "COMPLETED");
}
export async function cancelBooking(t: BookingType, id: string) {
  return runTransition(t, id, "CANCELLED");
}
export async function rejectBooking(t: BookingType, id: string) {
  return runTransition(t, id, "REJECTED");
}

/**
 * Front-desk manual check-in. If the booking has an associated ticket, this
 * consumes it through the same authoritative path a mobile QR scan would
 * use, so a walk-up check-in and a QR scan can never both "use" the same
 * ticket.
 */
export async function adminCheckIn(bookingType: BookingType, bookingId: string) {
  const admin = await requireAdmin();

  const ticket =
    bookingType === "homestay"
      ? await prisma.ticket.findFirst({ where: { homestayBookingId: bookingId } })
      : bookingType === "venue"
        ? await prisma.ticket.findFirst({ where: { venueBookingId: bookingId } })
        : await prisma.ticket.findFirst({ where: { edutripBookingId: bookingId } });

  if (ticket) {
    const result = await consumeTicketByCode(ticket.code, admin.id);
    revalidatePath("/admin/bookings");
    if (result.status !== "VALID") {
      return { error: result.message };
    }
    return {};
  }

  return runTransition(bookingType, bookingId, "CHECKED_IN");
}
