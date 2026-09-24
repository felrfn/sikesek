"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { logAudit } from "@/lib/audit";
import { amenityFacilitySchema } from "@/lib/validation/facility";
import { putPublicObject, StorageNotConfiguredError } from "@/lib/storage/r2";

async function uploadAmenityImage(file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.type.split("/")[1] ?? "jpg";
  return putPublicObject(
    `facilities/amenities/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`,
    buffer,
    file.type || "image/jpeg",
  );
}

export async function createAmenity(formData: FormData): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const parsed = amenityFacilitySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid facility data." };

  let imageUrl: string | undefined;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imageUrl = await uploadAmenityImage(file);
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        return { error: "Object storage is not configured - cannot upload an image right now." };
      }
      return { error: "Failed to upload image." };
    }
  }

  const facility = await prisma.facility.create({
    data: { ...parsed.data, imageUrl },
  });

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: "facility.created",
    entityType: "Facility",
    entityId: facility.id,
  });

  revalidatePath("/admin/amenities");
  return {};
}

export async function updateAmenity(id: string, formData: FormData): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const parsed = amenityFacilitySchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Invalid facility data." };

  let imageUrl: string | undefined;
  const file = formData.get("image");
  if (file instanceof File && file.size > 0) {
    try {
      imageUrl = await uploadAmenityImage(file);
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        return { error: "Object storage is not configured - cannot upload an image right now." };
      }
      return { error: "Failed to upload image." };
    }
  }

  await prisma.facility.update({
    where: { id },
    data: { ...parsed.data, ...(imageUrl ? { imageUrl } : {}) },
  });

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: "facility.updated",
    entityType: "Facility",
    entityId: id,
  });

  revalidatePath("/admin/amenities");
  return {};
}

export async function toggleAmenityActive(id: string, isActive: boolean) {
  const admin = await requireAdmin();
  await prisma.facility.update({ where: { id }, data: { isActive } });

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: isActive ? "facility.activated" : "facility.deactivated",
    entityType: "Facility",
    entityId: id,
  });

  revalidatePath("/admin/amenities");
}
