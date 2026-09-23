import { prisma } from "@/lib/prisma";

export function getDetections() {
  return prisma.smokingDetection.findMany({
    include: { area: true },
    orderBy: { detectedAt: "desc" },
  });
}

export async function getKtrStats() {
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

  const [violationsToday, loggedToday, totalResolved, areas] =
    await Promise.all([
      prisma.smokingDetection.count({
        where: { detectedAt: { gte: startOfToday } },
      }),
      prisma.smokingDetection.count({
        where: { detectedAt: { gte: startOfToday }, status: "DETECTED" },
      }),
      prisma.smokingDetection.count({ where: { status: "RESOLVED" } }),
      prisma.monitoredArea.findMany(),
    ]);

  const camerasOnline = areas.filter((a) => a.isActive).length;

  return {
    violationsToday,
    loggedToday,
    totalResolved,
    camerasOnline,
    camerasTotal: areas.length,
  };
}
