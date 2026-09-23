import { prisma } from "@/lib/prisma";

export async function getDashboardStats() {
  const [
    totalBookings,
    totalHomestays,
    totalVenues,
    totalEdutrips,
    activeHomestays,
    activeVenues,
    activeEdutrips,
    ktrViolationsToday,
    recentDetections,
    recentPayments,
  ] = await Promise.all([
    prisma.transaction.count(),
    prisma.homestay.count({ where: { deletedAt: null } }),
    prisma.venue.count({ where: { deletedAt: null } }),
    prisma.edutripPackage.count({ where: { deletedAt: null } }),
    prisma.homestay.count({ where: { deletedAt: null, isActive: true } }),
    prisma.venue.count({ where: { deletedAt: null, isActive: true } }),
    prisma.edutripPackage.count({ where: { deletedAt: null, isActive: true } }),
    prisma.smokingDetection.count({
      where: { detectedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
    }),
    prisma.smokingDetection.findMany({
      orderBy: { detectedAt: "desc" },
      take: 3,
      include: { area: true },
    }),
    prisma.transaction.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
  ]);

  const bookingsByDay = await getBookingsByWeekday();

  return {
    totalBookings,
    totalFacilities: totalHomestays + totalVenues + totalEdutrips,
    activeFacilities: activeHomestays + activeVenues + activeEdutrips,
    ktrViolationsToday,
    recentDetections,
    recentPayments,
    bookingsByDay,
  };
}

async function getBookingsByWeekday() {
  const since = new Date();
  since.setDate(since.getDate() - 7);

  const transactions = await prisma.transaction.findMany({
    where: { createdAt: { gte: since } },
    select: { createdAt: true },
  });

  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const counts = new Array(7).fill(0);
  for (const t of transactions) {
    counts[t.createdAt.getDay()] += 1;
  }

  return labels.map((label, i) => ({ label, count: counts[i] }));
}
