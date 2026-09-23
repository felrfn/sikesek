import { prisma } from "@/lib/prisma";

export function getStaffUsers() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "asc" },
  });
}
