import { prisma } from "@/lib/prisma";
import { generateInvoiceNumber, getHomestayNightlyRate } from "@/lib/pricing";
import type { SubmitBookingInput } from "@/lib/validation/booking";

class BookingError extends Error {}

/**
 * Recomputes every line item's price from the database rather than trusting
 * the client-submitted cart (RULES.md ยง2 - validate all user-controlled
 * input on the backend; never trust client-supplied prices).
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
  const homestayLines: {
    homestayId: string;
    checkInDate: Date;
    checkOutDate: Date;
    pricePerNight: bigint;
    subtotal: bigint;
  }[] = [];
  const venueLines: {
    venueId: string;
    bookingDate: Date;
    hours: number;
    pricePerHour: bigint;
    subtotal: bigint;
  }[] = [];
  const edutripLines: {
    packageId: string;
    visitDate: Date;
    pax: number;
    pricePerPax: bigint;
    subtotal: bigint;
  }[] = [];

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
      const subtotal = venue.pricePerHour * BigInt(item.hours);
      venueLines.push({
        venueId: venue.id,
        bookingDate: new Date(`${item.date}T00:00:00.000Z`),
        hours: item.hours,
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

  const transaction = await prisma.transaction.create({
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
          startTime: new Date("1970-01-01T09:00:00.000Z"),
          endTime: new Date(
            `1970-01-01T${String(9 + line.hours).padStart(2, "0")}:00:00.000Z`,
          ),
          totalHours: line.hours,
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

  return transaction;
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
