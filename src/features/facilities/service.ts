import { prisma } from "@/lib/prisma";

export type FacilityCategory = "homestay" | "venue" | "edutrip";

export interface UnifiedFacilityRow {
  id: string;
  category: FacilityCategory;
  categoryLabel: string;
  name: string;
  capacityLabel: string;
  priceLabel: string;
  isActive: boolean;
  // Homestay/venue photos live in object storage; EduTrip packages have no
  // image column, so the table falls back to a category placeholder.
  imageUrl: string | null;
  // Raw values for client-side sorting - display labels mix units
  // (/malam, /jam, /pax) so they can't be sorted as strings.
  priceAmount: number;
  capacityMax: number;
  createdAt: string;
}

export async function getUnifiedFacilities(): Promise<UnifiedFacilityRow[]> {
  const [homestays, venues, edutrips] = await Promise.all([
    prisma.homestay.findMany({ where: { deletedAt: null } }),
    prisma.venue.findMany({ where: { deletedAt: null } }),
    prisma.edutripPackage.findMany({ where: { deletedAt: null } }),
  ]);

  const rows: UnifiedFacilityRow[] = [
    ...homestays.map((h) => ({
      id: h.id,
      category: "homestay" as const,
      categoryLabel: "Homestay",
      name: h.name,
      capacityLabel: `${h.minCapacity}-${h.maxCapacity} Pax`,
      priceLabel: `Rp${h.weekdayPrice.toLocaleString("id-ID")}/malam`,
      isActive: h.isActive,
      imageUrl: h.imageUrl,
      priceAmount: Number(h.weekdayPrice),
      capacityMax: h.maxCapacity,
      createdAt: h.createdAt.toISOString(),
    })),
    ...venues.map((v) => ({
      id: v.id,
      category: "venue" as const,
      categoryLabel: "Venue",
      name: v.name,
      capacityLabel: `${v.minCapacity}-${v.maxCapacity} Pax`,
      priceLabel: `Rp${v.pricePerHour.toLocaleString("id-ID")}/jam`,
      isActive: v.isActive,
      imageUrl: v.imageUrl,
      priceAmount: Number(v.pricePerHour),
      capacityMax: v.maxCapacity,
      createdAt: v.createdAt.toISOString(),
    })),
    ...edutrips.map((e) => ({
      id: e.id,
      category: "edutrip" as const,
      categoryLabel: "Edutrip",
      name: e.name,
      capacityLabel: "-",
      priceLabel: `Rp${e.pricePerPax.toLocaleString("id-ID")}/pax`,
      isActive: e.isActive,
      imageUrl: null,
      priceAmount: Number(e.pricePerPax),
      capacityMax: 0,
      createdAt: e.createdAt.toISOString(),
    })),
  ];

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
