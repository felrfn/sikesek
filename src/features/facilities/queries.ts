"use server";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function getAmenitiesList() {
  await requireAdmin();
  return prisma.facility.findMany({ where: { isActive: true }, orderBy: { name: "asc" } });
}

export async function getActivitiesList() {
  await requireAdmin();
  return prisma.activity.findMany({ orderBy: { name: "asc" } });
}

export async function getHomestayFacilitySelections(homestayId: string) {
  await requireAdmin();
  const rows = await prisma.homestayFacility.findMany({ where: { homestayId } });
  return rows.map((r) => ({ facilityId: r.facilityId, descriptionOverride: r.descriptionOverride }));
}

export async function getEdutripIncludedItems(packageId: string) {
  await requireAdmin();
  const rows = await prisma.edutripPackageActivity.findMany({
    where: { packageId },
    orderBy: { sortOrder: "asc" },
    include: { activity: true },
  });
  return rows.map((r) => ({
    activityId: r.activityId,
    name: r.activity.name,
    descriptionOverride: r.descriptionOverride,
  }));
}
