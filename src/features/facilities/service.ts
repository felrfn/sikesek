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
      priceLabel: `Rp${h.weekdayPrice.toLocaleString("id-ID")}/night`,
      isActive: h.isActive,
    })),
    ...venues.map((v) => ({
      id: v.id,
      category: "venue" as const,
      categoryLabel: "Meeting Point",
      name: v.name,
      capacityLabel: `${v.minCapacity}-${v.maxCapacity} Pax`,
      priceLabel: `Rp${v.pricePerHour.toLocaleString("id-ID")}/hour`,
      isActive: v.isActive,
    })),
    ...edutrips.map((e) => ({
      id: e.id,
      category: "edutrip" as const,
      categoryLabel: "Edutrip",
      name: e.name,
      capacityLabel: "-",
      priceLabel: `Rp${e.pricePerPax.toLocaleString("id-ID")}/pax`,
      isActive: e.isActive,
    })),
  ];

  return rows.sort((a, b) => a.name.localeCompare(b.name));
}
