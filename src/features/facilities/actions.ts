"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { logAudit } from "@/lib/audit";
import {
  edutripInputSchema,
  homestayInputSchema,
  venueInputSchema,
} from "@/lib/validation/facility";
import { deleteObject, keyFromPublicUrl, putPublicObject, StorageNotConfiguredError } from "@/lib/storage/r2";
import type { FacilityCategory } from "./service";

function formToObject(formData: FormData) {
  const obj: Record<string, FormDataEntryValue> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) continue;
    obj[key] = value;
  }
  return obj;
}

async function uploadFacilityImage(category: FacilityCategory, file: File): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const extension = file.type.split("/")[1] ?? "jpg";
  return putPublicObject(
    `facilities/${category}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`,
    buffer,
    file.type || "image/jpeg",
  );
}

/** Best-effort cleanup for an image already uploaded to R2 when the rest of the save fails - avoids leaving orphaned objects in the bucket. */
async function deleteFacilityImage(imageUrl: string | undefined) {
  if (!imageUrl) return;
  const key = keyFromPublicUrl(imageUrl);
  if (key) await deleteObject(key).catch(() => {});
}

interface FacilitySelection {
  facilityId: string;
  descriptionOverride?: string;
}

/** Replaces a homestay's HomestayFacility rows with exactly the given selections (section 26/27). */
async function syncHomestayFacilities(homestayId: string, json: string | undefined) {
  if (json === undefined) return;
  let selections: FacilitySelection[];
  try {
    selections = JSON.parse(json);
  } catch {
    return;
  }

  await prisma.$transaction([
    prisma.homestayFacility.deleteMany({ where: { homestayId } }),
    ...selections.map((s) =>
      prisma.homestayFacility.create({
        data: {
          homestayId,
          facilityId: s.facilityId,
          descriptionOverride: s.descriptionOverride || undefined,
        },
      }),
    ),
  ]);
}

interface IncludedItem {
  activityId?: string;
  name: string;
  descriptionOverride?: string;
}

/** Replaces an EduTrip package's included items (section 29/30), creating new Activity catalog rows for any brand-new custom names. */
async function syncEdutripIncludedItems(packageId: string, json: string | undefined) {
  if (json === undefined) return;
  let items: IncludedItem[];
  try {
    items = JSON.parse(json);
  } catch {
    return;
  }

  const resolvedActivityIds: string[] = [];
  for (const item of items) {
    if (item.activityId) {
      resolvedActivityIds.push(item.activityId);
      continue;
    }
    const existing = await prisma.activity.findFirst({ where: { name: item.name } });
    const activity = existing ?? (await prisma.activity.create({ data: { name: item.name } }));
    resolvedActivityIds.push(activity.id);
  }

  await prisma.$transaction([
    prisma.edutripPackageActivity.deleteMany({ where: { packageId } }),
    ...items.map((item, index) =>
      prisma.edutripPackageActivity.create({
        data: {
          packageId,
          activityId: resolvedActivityIds[index],
          descriptionOverride: item.descriptionOverride || undefined,
          sortOrder: index,
        },
      }),
    ),
  ]);
}

export async function createFacility(
  category: FacilityCategory,
  formData: FormData,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const raw = formToObject(formData);

  let imageUrl: string | undefined;
  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imageUrl = await uploadFacilityImage(category, imageFile);
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        return { error: "Object storage is not configured - cannot upload an image right now." };
      }
      return { error: "Failed to upload image." };
    }
  }

  let id: string;
  try {
    if (category === "homestay") {
      const parsed = homestayInputSchema.safeParse(raw);
      if (!parsed.success) {
        await deleteFacilityImage(imageUrl);
        return { error: "Invalid homestay data" };
      }
      const record = await prisma.homestay.create({ data: { ...parsed.data, imageUrl } });
      id = record.id;
      await syncHomestayFacilities(id, raw.facilitySelectionsJson as string | undefined);
    } else if (category === "venue") {
      const parsed = venueInputSchema.safeParse(raw);
      if (!parsed.success) {
        await deleteFacilityImage(imageUrl);
        return { error: "Invalid meeting point data" };
      }
      const record = await prisma.venue.create({ data: { ...parsed.data, imageUrl } });
      id = record.id;
    } else {
      const parsed = edutripInputSchema.safeParse(raw);
      if (!parsed.success) {
        await deleteFacilityImage(imageUrl);
        return { error: "Invalid edutrip data" };
      }
      const record = await prisma.edutripPackage.create({ data: parsed.data });
      id = record.id;
      await syncEdutripIncludedItems(id, raw.includedItemsJson as string | undefined);
    }
  } catch {
    await deleteFacilityImage(imageUrl);
    return { error: "Failed to save facility." };
  }

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: `${category}.created`,
    entityType: category,
    entityId: id,
  });

  revalidatePath("/admin/facilities");
  return {};
}

export async function updateFacility(
  category: FacilityCategory,
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  const admin = await requireAdmin();
  const raw = formToObject(formData);

  let imageUrl: string | undefined;
  const imageFile = formData.get("image");
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imageUrl = await uploadFacilityImage(category, imageFile);
    } catch (error) {
      if (error instanceof StorageNotConfiguredError) {
        return { error: "Object storage is not configured - cannot upload an image right now." };
      }
      return { error: "Failed to upload image." };
    }
  }

  try {
    if (category === "homestay") {
      const parsed = homestayInputSchema.safeParse(raw);
      if (!parsed.success) {
        await deleteFacilityImage(imageUrl);
        return { error: "Invalid homestay data" };
      }
      await prisma.homestay.update({
        where: { id },
        data: { ...parsed.data, ...(imageUrl ? { imageUrl } : {}) },
      });
      await syncHomestayFacilities(id, raw.facilitySelectionsJson as string | undefined);
    } else if (category === "venue") {
      const parsed = venueInputSchema.safeParse(raw);
      if (!parsed.success) {
        await deleteFacilityImage(imageUrl);
        return { error: "Invalid meeting point data" };
      }
      await prisma.venue.update({
        where: { id },
        data: { ...parsed.data, ...(imageUrl ? { imageUrl } : {}) },
      });
    } else {
      const parsed = edutripInputSchema.safeParse(raw);
      if (!parsed.success) {
        await deleteFacilityImage(imageUrl);
        return { error: "Invalid edutrip data" };
      }
      await prisma.edutripPackage.update({ where: { id }, data: parsed.data });
      await syncEdutripIncludedItems(id, raw.includedItemsJson as string | undefined);
    }
  } catch {
    await deleteFacilityImage(imageUrl);
    return { error: "Failed to save facility." };
  }

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: `${category}.updated`,
    entityType: category,
    entityId: id,
  });

  revalidatePath("/admin/facilities");
  return {};
}

export async function toggleFacilityActive(
  category: FacilityCategory,
  id: string,
  isActive: boolean,
) {
  await requireAdmin();

  if (category === "homestay") {
    await prisma.homestay.update({ where: { id }, data: { isActive } });
  } else if (category === "venue") {
    await prisma.venue.update({ where: { id }, data: { isActive } });
  } else {
    await prisma.edutripPackage.update({ where: { id }, data: { isActive } });
  }

  revalidatePath("/admin/facilities");
}

export async function deleteFacility(category: FacilityCategory, id: string) {
  const admin = await requireAdmin();
  const data = { deletedAt: new Date(), isActive: false };

  let imageUrl: string | null | undefined;
  if (category === "homestay") {
    const record = await prisma.homestay.update({ where: { id }, data });
    imageUrl = record.imageUrl;
  } else if (category === "venue") {
    const record = await prisma.venue.update({ where: { id }, data });
    imageUrl = record.imageUrl;
  } else {
    await prisma.edutripPackage.update({ where: { id }, data });
  }

  // Facilities are never restorable once archived (admin list queries filter
  // deletedAt: null), so the photo can be removed from R2 straight away.
  await deleteFacilityImage(imageUrl ?? undefined);

  await logAudit({
    actor: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
    action: `${category}.archived`,
    entityType: category,
    entityId: id,
  });

  revalidatePath("/admin/facilities");
}

export async function getFacilityForEdit(
  category: FacilityCategory,
  id: string,
) {
  await requireAdmin();

  if (category === "homestay") return prisma.homestay.findUnique({ where: { id } });
  if (category === "venue") return prisma.venue.findUnique({ where: { id } });
  return prisma.edutripPackage.findUnique({ where: { id } });
}
