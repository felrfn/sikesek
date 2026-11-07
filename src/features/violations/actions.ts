"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { logAudit } from "@/lib/audit";
import {
  manualDetectionSchema,
  updateDetectionSchema,
} from "@/lib/validation/ktr";
import { resolveDetectionForUser } from "./service";
import {
  putPrivateObject,
  resolveEvidenceUrl,
  StorageNotConfiguredError,
} from "@/lib/storage/objectStorage";

function actorOf(admin: { id: string; name?: string | null; email?: string | null }) {
  return { id: admin.id, name: admin.name ?? admin.email ?? "Admin" };
}

/**
 * Marks a violation resolved. Callable by an admin (here) or, with the
 * equivalent field-officer-attributed fields, via
 * POST /api/mobile/ktr/{id}/resolve - both paths set `resolvedBy` to
 * whichever user actually performed the action (section 1's explicit
 * requirement never to assume the current session is an admin).
 */
export async function resolveDetection(detectionId: string, notes?: string) {
  const admin = await requireAdmin();

  const result = await resolveDetectionForUser({
    detectionId,
    resolver: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    notes,
  });

  if (!result.alreadyResolved) {
    await logAudit({
      actor: actorOf(admin),
      action: "ktr.resolved",
      entityType: "SmokingDetection",
      entityId: detectionId,
    });
  }

  revalidatePath("/admin/ktr-monitoring");
}

export async function reopenDetection(detectionId: string) {
  const admin = await requireAdmin();

  await prisma.smokingDetection.update({
    where: { id: detectionId },
    data: {
      status: "NOTIFIED",
      resolvedBy: null,
      resolvedAt: null,
      // Reopening makes the case claimable again; otherwise the previous
      // handler's soft lock would block everyone after the reopen.
      handlingById: null,
      handlingStartedAt: null,
    },
  });

  await logAudit({
    actor: actorOf(admin),
    action: "ktr.reopened",
    entityType: "SmokingDetection",
    entityId: detectionId,
  });

  revalidatePath("/admin/ktr-monitoring");
}

/**
 * The AI/system flagged something that wasn't actually a violation -
 * distinct from `dismissDetection` (section 19), which is an admin closing
 * a real but operationally-moot case. Soft-archived, never hard-deleted
 * (section 21) - the evidence and detection stay auditable.
 */
export async function markFalsePositive(detectionId: string, notes?: string) {
  const admin = await requireAdmin();

  await prisma.smokingDetection.update({
    where: { id: detectionId },
    data: {
      status: "FALSE_POSITIVE",
      resolvedBy: admin.id,
      resolvedAt: new Date(),
      notes: notes || undefined,
    },
  });

  await prisma.ktrAssignment.updateMany({
    where: {
      detectionId,
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
    },
    data: { status: "CANCELLED" },
  });

  await logAudit({
    actor: actorOf(admin),
    action: "ktr.false_positive",
    entityType: "SmokingDetection",
    entityId: detectionId,
  });

  revalidatePath("/admin/ktr-monitoring");
}

/** Admin-initiated closure for an operational reason, not a detection-accuracy judgment (section 19). */
export async function dismissDetection(detectionId: string, notes?: string) {
  const admin = await requireAdmin();

  await prisma.smokingDetection.update({
    where: { id: detectionId },
    data: {
      status: "DISMISSED",
      resolvedBy: admin.id,
      resolvedAt: new Date(),
      notes: notes || undefined,
    },
  });

  await prisma.ktrAssignment.updateMany({
    where: {
      detectionId,
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
    },
    data: { status: "CANCELLED" },
  });

  await logAudit({
    actor: actorOf(admin),
    action: "ktr.dismissed",
    entityType: "SmokingDetection",
    entityId: detectionId,
  });

  revalidatePath("/admin/ktr-monitoring");
}

function formToObject(formData: FormData) {
  const obj: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    obj[key] = value;
  }
  if (obj.confidence) obj.confidence = Number(obj.confidence);
  return obj;
}

export async function createManualDetection(
  formData: FormData,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const file = formData.get("evidenceFile");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "An evidence photo is required." };
  }

  const parsed = manualDetectionSchema
    .omit({ evidenceKey: true })
    .safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Invalid detection data" };

  let evidenceKey: string;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const extension = file.type.split("/")[1] ?? "jpg";
    evidenceKey = await putPrivateObject(
      `ktr/evidence/${parsed.data.areaId}/${Date.now()}-${admin.id.slice(0, 8)}.${extension}`,
      buffer,
      file.type || "image/jpeg",
    );
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return {
        error:
          "Object storage is not configured in this environment, so evidence photos can't be uploaded yet.",
      };
    }
    return { error: "Failed to upload evidence photo." };
  }

  await prisma.smokingDetection.create({
    data: {
      areaId: parsed.data.areaId,
      confidence: parsed.data.confidence,
      evidenceKey,
      detectedAt: parsed.data.detectedAt
        ? new Date(parsed.data.detectedAt)
        : new Date(),
      notes: parsed.data.notes,
      source: "MANUAL",
      status: "DETECTED",
    },
  });

  revalidatePath("/admin/ktr-monitoring");
  return {};
}

export async function updateDetection(
  detectionId: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = updateDetectionSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: "Invalid detection data" };

  await prisma.smokingDetection.update({
    where: { id: detectionId },
    data: {
      areaId: parsed.data.areaId,
      confidence: parsed.data.confidence,
      detectedAt: parsed.data.detectedAt
        ? new Date(parsed.data.detectedAt)
        : undefined,
      notes: parsed.data.notes,
    },
  });

  revalidatePath("/admin/ktr-monitoring");
  return {};
}

/**
 * Deletion is restricted to admins (already enforced by requireAdmin) and
 * is meant for cleaning up duplicate/erroneous records - each delete is a
 * distinct audited server action call rather than a bulk/generic endpoint.
 */
export async function deleteDetection(detectionId: string) {
  const admin = await requireAdmin();

  await prisma.notification.deleteMany({ where: { detectionId } });
  await prisma.smokingDetection.delete({ where: { id: detectionId } });

  console.info(
    `[audit] KTR detection ${detectionId} deleted by admin ${admin.id}`,
  );
  revalidatePath("/admin/ktr-monitoring");
}

export async function getEvidenceUrl(
  evidenceKey: string,
): Promise<{ url?: string; error?: string }> {
  await requireAdmin();

  try {
    const url = await resolveEvidenceUrl(evidenceKey);
    return { url };
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return { error: "Object storage is not configured in this environment." };
    }
    return { error: "Could not generate evidence URL." };
  }
}
