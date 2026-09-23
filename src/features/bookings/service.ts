import { prisma } from "@/lib/prisma";

export interface UnifiedBookingRow {
  bookingId: string;
  bookingType: "homestay" | "venue" | "edutrip";
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
