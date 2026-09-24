"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { holidayInputSchema } from "@/lib/validation/holiday";

function formToObject(formData: FormData) {
  return {
    date: formData.get("date"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    isClosed: formData.get("isClosed") === "true",
  };
}

export async function createHoliday(formData: FormData): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = holidayInputSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid holiday data" };

  try {
    await prisma.holiday.create({
      data: {
        date: new Date(`${parsed.data.date}T00:00:00.000Z`),
        name: parsed.data.name,
        description: parsed.data.description,
        isClosed: parsed.data.isClosed,
      },
    });
  } catch {
    return { error: "A holiday already exists for this date." };
  }

  revalidatePath("/admin/holidays");
  revalidatePath("/booking");
  return {};
}

export async function updateHoliday(
  id: string,
  formData: FormData,
): Promise<{ error?: string }> {
  await requireAdmin();
  const parsed = holidayInputSchema.safeParse(formToObject(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid holiday data" };

  try {
    await prisma.holiday.update({
      where: { id },
      data: {
        date: new Date(`${parsed.data.date}T00:00:00.000Z`),
        name: parsed.data.name,
        description: parsed.data.description,
        isClosed: parsed.data.isClosed,
      },
    });
  } catch {
    return { error: "Another holiday already exists for this date." };
  }

  revalidatePath("/admin/holidays");
  revalidatePath("/booking");
  return {};
}

export async function deleteHoliday(id: string) {
  await requireAdmin();
  await prisma.holiday.delete({ where: { id } });
  revalidatePath("/admin/holidays");
  revalidatePath("/booking");
}
