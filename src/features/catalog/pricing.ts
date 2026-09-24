"use server";

import { prisma } from "@/lib/prisma";
import { getHomestayNightlyRate, type RateTier } from "@/lib/pricing";

/**
 * The booking page's live price preview (section 8/10) calls this instead
 * of assuming `weekdayPrice` - it's the exact same calculation
 * (`getHomestayNightlyRate`) the backend uses when it actually creates the
 * booking, so what the customer sees here is guaranteed to match what gets
 * charged (barring a real race on availability, which is a separate
 * concern from price).
 */
export async function getHomestayPricesForDate(
  dateIso: string,
): Promise<Record<string, { amount: number; tier: RateTier }>> {
  const date = new Date(`${dateIso}T00:00:00.000Z`);

  const [homestays, holidays] = await Promise.all([
    prisma.homestay.findMany({
      where: { isActive: true, deletedAt: null },
      include: { specialPrices: true },
    }),
    prisma.holiday.findMany(),
  ]);

  const result: Record<string, { amount: number; tier: RateTier }> = {};
  for (const homestay of homestays) {
    const { amount, tier } = getHomestayNightlyRate(
      homestay,
      date,
      homestay.specialPrices,
      holidays,
    );
    result[homestay.id] = { amount: Number(amount), tier };
  }
  return result;
}
