"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  AssignmentError,
  cancelAssignment,
  createAssignments,
} from "./service";

export async function assignKtrWorkers(input: {
  detectionId: string;
  workerIds: string[];
  note?: string;
  overrideUnavailable?: boolean;
}): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  try {
    await createAssignments({
      detectionId: input.detectionId,
      workerIds: input.workerIds,
      note: input.note,
      overrideUnavailable: input.overrideUnavailable,
      assignedBy: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    });
  } catch (error) {
    if (error instanceof AssignmentError) return { error: error.message };
    throw error;
  }

  revalidatePath("/admin/ktr-monitoring");
  return {};
}

export async function cancelKtrAssignment(assignmentId: string) {
  const admin = await requireAdmin();
  await cancelAssignment(assignmentId, {
    id: admin.id,
    name: admin.name ?? admin.email ?? "Admin",
  });
  revalidatePath("/admin/ktr-monitoring");
}
