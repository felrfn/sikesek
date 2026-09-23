import { prisma } from "@/lib/prisma";

export function getActiveHomestays() {
  return prisma.homestay.findMany({
    where: { isActive: true, deletedAt: null },
    include: { facilities: { include: { facility: true } } },
    orderBy: { weekdayPrice: "asc" },
  });
}

export function getActiveVenues() {
  return prisma.venue.findMany({
    where: { isActive: true, deletedAt: null },
    include: { availableDays: true },
    orderBy: { pricePerHour: "desc" },
  });
}

export function getActiveEdutripPackages() {
  return prisma.edutripPackage.findMany({
    where: { isActive: true, deletedAt: null },
    include: { activities: { include: { activity: true } } },
    orderBy: { pricePerPax: "asc" },
  });
}

export async function getBookableCatalog() {
  const [homestays, venues, edutrips] = await Promise.all([
    getActiveHomestays(),
    getActiveVenues(),
    getActiveEdutripPackages(),
  ]);
  return { homestays, venues, edutrips };
}
