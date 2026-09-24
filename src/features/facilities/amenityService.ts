import { prisma } from "@/lib/prisma";

/** The amenity catalog (Facility model - "Kamar mandi dalam", "TV", ...), distinct from the Homestay/Venue/Edutrip catalog under /admin/facilities (section 25). */
export function getAmenities() {
  return prisma.facility.findMany({ orderBy: { name: "asc" } });
}
