"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { logAudit } from "@/lib/audit";
import { monitoredAreaInputSchema } from "@/lib/validation/ktr";

function actorOf(admin: { id: string; name?: string | null; email?: string | null }) {
  return { id: admin.id, name: admin.name ?? admin.email ?? "Admin" };
}

function formToObject(formData: FormData) {
  const locationDescription = formData.get("locationDescription");
  const assignedEmployeeId = formData.get("assignedEmployeeId");
  const streamUrl = formData.get("streamUrl");

  return {
    name: formData.get("name"),
    locationDescription:
      typeof locationDescription === "string" && locationDescription.trim()
        ? locationDescription
        : undefined,
    streamUrl:
      typeof streamUrl === "string" && streamUrl.trim() ? streamUrl : undefined,
    assignedEmployeeId:
      typeof assignedEmployeeId === "string" && assignedEmployeeId
        ? assignedEmployeeId
        : undefined,
    isActive: formData.get("isActive") === "true",
  };
}

function revalidateAreaViews() {
  revalidatePath("/admin/ktr-areas");
  revalidatePath("/admin/ktr-monitoring");
}

export async function createKtrArea(
  formData: FormData,
): Promise<{ error?: string; areaId?: string }> {
  const admin = await requireAdmin();

  const parsed = monitoredAreaInputSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid area data" };
  }

  try {
    const area = await prisma.monitoredArea.create({
      data: {
        name: parsed.data.name,
        locationDescription: parsed.data.locationDescription ?? null,
        streamUrl: parsed.data.streamUrl ?? null,
        assignedEmployeeId: parsed.data.assignedEmployeeId ?? null,
        isActive: parsed.data.isActive,
      },
    });

    await logAudit({
      actor: actorOf(admin),
      action: "ktrArea.created",
      entityType: "MonitoredArea",
      entityId: area.id,
      metadata: { name: area.name, streamUrl: area.streamUrl },
    });

    revalidateAreaViews();
    return { areaId: area.id };
  } catch {
    return { error: "Could not create the monitored area." };
  }
}

export async function updateKtrArea(
  areaId: string,
  formData: FormData,
): Promise<{ error?: string; areaId?: string }> {
  const admin = await requireAdmin();

  const parsed = monitoredAreaInputSchema.safeParse(formToObject(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid area data" };
  }

  try {
    const area = await prisma.monitoredArea.update({
      where: { id: areaId },
      data: {
        name: parsed.data.name,
        locationDescription: parsed.data.locationDescription ?? null,
        streamUrl: parsed.data.streamUrl ?? null,
        assignedEmployeeId: parsed.data.assignedEmployeeId ?? null,
        isActive: parsed.data.isActive,
      },
    });

    await logAudit({
      actor: actorOf(admin),
      action: "ktrArea.updated",
      entityType: "MonitoredArea",
      entityId: area.id,
      metadata: { name: area.name, streamUrl: area.streamUrl, isActive: area.isActive },
    });

    revalidateAreaViews();
    return {};
  } catch {
    return { error: "Could not update the monitored area." };
  }
}

/**
 * Activation is deliberately a separate action from the edit form: an
 * admin pausing a camera should be one click, and it is distinct in the
 * audit log from changing the area's address/stream.
 */
export async function setKtrAreaActive(
  areaId: string,
  isActive: boolean,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  try {
    const area = await prisma.monitoredArea.update({
      where: { id: areaId },
      data: { isActive },
    });

    await logAudit({
      actor: actorOf(admin),
      action: isActive ? "ktrArea.activated" : "ktrArea.deactivated",
      entityType: "MonitoredArea",
      entityId: area.id,
      metadata: { name: area.name, isActive },
    });

    revalidateAreaViews();
    return {};
  } catch {
    return { error: "Could not change the monitored area's status." };
  }
}

/**
 * Hard deletion is only allowed while no detection references the area
 * (smoking_detections.area_id is ON DELETE RESTRICT). Once evidence exists,
 * deactivating is the correct action - historical detections must stay
 * attributable to the area they happened in.
 */
export async function deleteKtrArea(areaId: string): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const detectionCount = await prisma.smokingDetection.count({
    where: { areaId },
  });
  if (detectionCount > 0) {
    return {
      error:
        "This area already has detection records, so it can't be deleted. Deactivate it instead.",
    };
  }

  try {
    const area = await prisma.monitoredArea.delete({ where: { id: areaId } });

    await logAudit({
      actor: actorOf(admin),
      action: "ktrArea.deleted",
      entityType: "MonitoredArea",
      entityId: area.id,
      metadata: { name: area.name, streamUrl: area.streamUrl },
    });

    revalidateAreaViews();
    return {};
  } catch {
    return { error: "Could not delete the monitored area." };
  }
}
