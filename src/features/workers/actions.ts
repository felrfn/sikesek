"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { logAudit } from "@/lib/audit";

const setAvailabilitySchema = z.object({
  workerId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "LEAVE", "OFF"]),
  note: z.string().trim().max(500).optional(),
});

/**
 * Sets (or clears back to the implicit AVAILABLE default) a worker's
 * availability for one calendar date. Every change is audited with the
 * before/after status (section 6) - operational records like this are
 * never silently mutated.
 */
export async function setWorkerAvailability(
  input: z.infer<typeof setAvailabilitySchema>,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const parsed = setAvailabilitySchema.safeParse(input);
  if (!parsed.success) return { error: "Invalid availability data." };

  const { workerId, date, status, note } = parsed.data;

  const previous = await prisma.workerSchedule.findUnique({
    where: { workerId_date: { workerId, date: new Date(date) } },
  });

  const updated = await prisma.workerSchedule.upsert({
    where: { workerId_date: { workerId, date: new Date(date) } },
    update: { status, note, changedById: admin.id },
    create: { workerId, date: new Date(date), status, note, changedById: admin.id },
  });

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: "worker.availability_changed",
    entityType: "WorkerSchedule",
    entityId: updated.id,
    metadata: {
      workerId,
      date,
      from: previous?.status ?? "AVAILABLE",
      to: status,
      reason: note ?? null,
    },
  });

  revalidatePath("/admin/workers");
  return {};
}
