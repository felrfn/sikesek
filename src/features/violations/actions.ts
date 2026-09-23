"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";

export async function resolveDetection(detectionId: string, notes?: string) {
  const admin = await requireAdmin();

  await prisma.smokingDetection.update({
    where: { id: detectionId },
    data: {
      status: "RESOLVED",
      resolvedBy: admin.id,
      resolvedAt: new Date(),
      notes: notes || undefined,
    },
  });

  revalidatePath("/admin/ktr-monitoring");
}
