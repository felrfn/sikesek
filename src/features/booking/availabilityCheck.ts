import { prisma } from "@/lib/prisma";
import type { CartItemInput } from "@/lib/validation/booking";
import { findEdutripConflict } from "./categories/edutrip";
import { findHomestayConflict } from "./categories/homestay";
import { closedHolidayMessage } from "./categories/shared";
import { findVenueConflict } from "./categories/venue";

export interface AvailabilityConflict {
  index: number;
  message: string;
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
            message: "Homestay ini sudah dipesan pada tanggal yang dipilih.",
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
            message: "Venue ini sudah dipesan pada jam yang tumpang tindih.",
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
            message: "Paket Edutrip ini sudah dipesan pada tanggal yang dipilih.",
          });
        }
      }
    }),
  );

  return conflicts.sort((a, b) => a.index - b.index);
}
