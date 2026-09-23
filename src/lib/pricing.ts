import type { Homestay, HomestaySpecialPrice } from "@prisma/client";

export type RateTier = "WEEKDAY" | "WEEKEND" | "HOLIDAY";

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

/**
 * Nightly rate for a homestay on a given date.
 * A matching `HomestaySpecialPrice` (curated holiday/event date) takes
 * priority over the plain weekday/weekend split.
 */
export function getHomestayNightlyRate(
  homestay: Pick<Homestay, "weekdayPrice" | "weekendPrice">,
  date: Date,
  specialPrices: Pick<HomestaySpecialPrice, "date" | "price">[] = [],
): { amount: bigint; tier: RateTier } {
  const dateKey = date.toISOString().slice(0, 10);
  const special = specialPrices.find(
    (special) => special.date.toISOString().slice(0, 10) === dateKey,
  );
  if (special) {
    return { amount: special.price, tier: "HOLIDAY" };
  }

  return isWeekend(date)
    ? { amount: homestay.weekendPrice, tier: "WEEKEND" }
    : { amount: homestay.weekdayPrice, tier: "WEEKDAY" };
}

export function nightsBetween(checkIn: Date, checkOut: Date) {
  const msPerNight = 24 * 60 * 60 * 1000;
  return Math.max(
    1,
    Math.round((checkOut.getTime() - checkIn.getTime()) / msPerNight),
  );
}

export function generateInvoiceNumber() {
  const now = new Date();
  const datePart = now.toISOString().slice(0, 10).replace(/-/g, "");
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${datePart}-${randomPart}`;
}
