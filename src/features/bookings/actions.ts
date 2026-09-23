"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { checkInBooking, type BookingType } from "@/features/tickets/service";

export async function adminCheckIn(bookingType: BookingType, bookingId: string) {
  await requireAdmin();
  const result = await checkInBooking(bookingType, bookingId);
  revalidatePath("/admin/bookings");
  return result;
}
