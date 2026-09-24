import { prisma } from "@/lib/prisma";

export function getHolidays() {
  return prisma.holiday.findMany({ orderBy: { date: "asc" } });
}

/** ISO (`YYYY-MM-DD`) dates that are fully closed for booking - used to
 * disable those days in the public calendar (section 7). */
export async function getClosedDates(): Promise<string[]> {
  const holidays = await prisma.holiday.findMany({
    where: { isClosed: true },
    select: { date: true },
  });
  return holidays.map((h) => h.date.toISOString().slice(0, 10));
}
