"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import {
  edutripInputSchema,
  homestayInputSchema,
  venueInputSchema,
} from "@/lib/validation/facility";
import type { FacilityCategory } from "./service";

function formToObject(formData: FormData) {
  return Object.fromEntries(formData.entries());
}

export async function createFacility(
  category: FacilityCategory,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const raw = formToObject(formData);

  if (category === "homestay") {
    const parsed = homestayInputSchema.safeParse(raw);
    if (!parsed.success) return { error: "Invalid homestay data" };
    await prisma.homestay.create({ data: parsed.data });
  } else if (category === "venue") {
    const parsed = venueInputSchema.safeParse(raw);
    if (!parsed.success) return { error: "Invalid meeting point data" };
    await prisma.venue.create({ data: parsed.data });
  } else {
    const parsed = edutripInputSchema.safeParse(raw);
    if (!parsed.success) return { error: "Invalid edutrip data" };
    await prisma.edutripPackage.create({ data: parsed.data });
  }

  revalidatePath("/admin/facilities");
  return {};
}

export async function updateFacility(
  category: FacilityCategory,
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const raw = formToObject(formData);

  if (category === "homestay") {
    const parsed = homestayInputSchema.safeParse(raw);
    if (!parsed.success) return { error: "Invalid homestay data" };
    await prisma.homestay.update({ where: { id }, data: parsed.data });
  } else if (category === "venue") {
    const parsed = venueInputSchema.safeParse(raw);
    if (!parsed.success) return { error: "Invalid meeting point data" };
    await prisma.venue.update({ where: { id }, data: parsed.data });
  } else {
    const parsed = edutripInputSchema.safeParse(raw);
    if (!parsed.success) return { error: "Invalid edutrip data" };
    await prisma.edutripPackage.update({ where: { id }, data: parsed.data });
  }

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
  await requireAdmin();
  const data = { deletedAt: new Date(), isActive: false };

  if (category === "homestay") {
    await prisma.homestay.update({ where: { id }, data });
  } else if (category === "venue") {
    await prisma.venue.update({ where: { id }, data });
  } else {
    await prisma.edutripPackage.update({ where: { id }, data });
  }

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
