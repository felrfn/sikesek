import { prisma } from "@/lib/prisma";

/** Admin list: every area (active and inactive) plus how many detections it has. */
export function getKtrAreas() {
  return prisma.monitoredArea.findMany({
    orderBy: { name: "asc" },
    include: {
      assignedEmployee: { select: { id: true, name: true } },
      _count: { select: { detections: true } },
    },
  });
}

/** Approved field officers who can be set as an area's default officer. */
export function getAssignableOfficers() {
  return prisma.user.findMany({
    where: {
      role: "FIELD_OFFICER",
      deletedAt: null,
      approvedAt: { not: null },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
