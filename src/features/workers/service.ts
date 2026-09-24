import { prisma } from "@/lib/prisma";

export function getWorkers() {
  return prisma.user.findMany({
    where: { role: "FIELD_OFFICER", deletedAt: null },
    orderBy: { name: "asc" },
  });
}

export function getWorkerDetail(workerId: string) {
  return prisma.user.findUnique({
    where: { id: workerId },
    include: {
      ktrAssignmentsAsWorker: {
        orderBy: { assignedAt: "desc" },
        take: 20,
        include: {
          detection: { select: { id: true, status: true, detectedAt: true, area: { select: { name: true } } } },
        },
      },
      resolvedDetections: {
        orderBy: { resolvedAt: "desc" },
        take: 20,
        select: { id: true, status: true, resolvedAt: true, area: { select: { name: true } } },
      },
    },
  });
}

/** Month view (YYYY-MM) of a worker's schedule, WIB calendar dates. */
export function getWorkerScheduleForMonth(workerId: string, yearMonth: string) {
  const [year, month] = yearMonth.split("-").map(Number);
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));

  return prisma.workerSchedule.findMany({
    where: { workerId, date: { gte: start, lt: end } },
    orderBy: { date: "asc" },
  });
}

export function getSchedulesForDate(date: string) {
  return prisma.workerSchedule.findMany({
    where: { date: new Date(date) },
    include: { worker: { select: { id: true, name: true } } },
  });
}
