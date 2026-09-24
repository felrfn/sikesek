import { prisma } from "@/lib/prisma";
import type { Prisma, DetectionStatus } from "@prisma/client";
import { jakartaDayBoundsUtc } from "@/lib/utils/adminQuery";
import { getTodayInJakarta } from "@/lib/siteConfig";

export type KtrView = "today" | "all";

export interface KtrListParams {
  view: KtrView;
  status?: DetectionStatus;
  dateFrom?: Date;
  dateTo?: Date;
  dateField?: "detectedAt" | "resolvedAt";
  skip: number;
  take: number;
}

/**
 * Server-side filtered/paginated detection list (sections 16/20/45) - never
 * loads the full table into the browser to paginate client-side. "Today" is
 * computed against the site's WIB business day, not the server's local/UTC
 * day (section 46's exact hydration/timezone bug class).
 */
export async function getDetectionsPage(params: KtrListParams) {
  const where: Prisma.SmokingDetectionWhereInput = {};

  if (params.view === "today") {
    const { start, end } = jakartaDayBoundsUtc(getTodayInJakarta());
    where.detectedAt = { gte: start, lt: end };
  }

  if (params.status) where.status = params.status;

  const dateField = params.dateField ?? "detectedAt";
  if (params.dateFrom || params.dateTo) {
    where[dateField] = {
      ...(params.dateFrom ? { gte: params.dateFrom } : {}),
      ...(params.dateTo ? { lt: params.dateTo } : {}),
    };
  }

  const [detections, total] = await Promise.all([
    prisma.smokingDetection.findMany({
      where,
      include: {
        area: true,
        resolvedByUser: { select: { id: true, name: true } },
        assignments: {
          where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
          include: { assignedTo: { select: { id: true, name: true } } },
        },
      },
      orderBy: { detectedAt: "desc" },
      skip: params.skip,
      take: params.take,
    }),
    prisma.smokingDetection.count({ where }),
  ]);

  return { detections, total };
}

export async function getKtrStats() {
  const { start, end } = jakartaDayBoundsUtc(getTodayInJakarta());

  const [violationsToday, loggedToday, assigned, inProgress, totalResolved, falsePositive, areas] =
    await Promise.all([
      prisma.smokingDetection.count({
        where: { detectedAt: { gte: start, lt: end } },
      }),
      prisma.smokingDetection.count({
        where: { detectedAt: { gte: start, lt: end }, status: "DETECTED" },
      }),
      prisma.smokingDetection.count({ where: { status: "ASSIGNED" } }),
      prisma.smokingDetection.count({ where: { status: "IN_PROGRESS" } }),
      prisma.smokingDetection.count({ where: { status: "RESOLVED" } }),
      // False positives are deliberately not counted as resolved violations
      // (section 22) - they're tracked separately since they were never a
      // real violation to begin with.
      prisma.smokingDetection.count({ where: { status: "FALSE_POSITIVE" } }),
      prisma.monitoredArea.findMany(),
    ]);

  const camerasOnline = areas.filter((a) => a.isActive).length;

  return {
    violationsToday,
    loggedToday,
    assigned,
    inProgress,
    totalResolved,
    falsePositive,
    camerasOnline,
    camerasTotal: areas.length,
  };
}
