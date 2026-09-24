import type { Holiday, Homestay, HomestaySpecialPrice } from "@prisma/client";

export type RateTier = "WEEKDAY" | "WEEKEND" | "HOLIDAY";

function isWeekend(date: Date) {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

function dateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function findHolidayForDate(
  date: Date,
  holidays: Pick<Holiday, "date" | "isClosed">[],
) {
  const key = dateKey(date);
  return holidays.find((h) => dateKey(h.date) === key);
}

/**
 * True when an admin has marked this date fully closed (e.g. maintenance) -
 * applies to every facility type (RULES.md ยง9), independent of whether the
 * date also affects pricing.
 */
export function isDateClosedForBooking(
  date: Date,
  holidays: Pick<Holiday, "date" | "isClosed">[],
) {
  return findHolidayForDate(date, holidays)?.isClosed ?? false;
}

/**
 * Nightly rate for a homestay on a given date - the single source of truth
 * used by both the booking page's live price preview and the backend's
 * actual charge (features/catalog/pricing.ts and
 * features/booking/service.ts respectively). Priority, most to least
 * specific: an exact-date `HomestaySpecialPrice` override, then a
 * configured Holiday (uses the homestay's own `holidayPrice` tier), then
 * the plain weekday/weekend split.
 */
export function getHomestayNightlyRate(
  homestay: Pick<Homestay, "weekdayPrice" | "weekendPrice" | "holidayPrice">,
  date: Date,
  specialPrices: Pick<HomestaySpecialPrice, "date" | "price">[] = [],
  holidays: Pick<Holiday, "date" | "isClosed">[] = [],
): { amount: bigint; tier: RateTier } {
  const key = dateKey(date);
  const special = specialPrices.find((special) => dateKey(special.date) === key);
  if (special) {
    return { amount: special.price, tier: "HOLIDAY" };
  }

  if (findHolidayForDate(date, holidays)) {
    return { amount: homestay.holidayPrice, tier: "HOLIDAY" };
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
