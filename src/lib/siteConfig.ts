/**
 * Shared operational constants shown across the public site (facility
 * cards) and used to compute ticket validity windows. Centralized here so
 * the two stay in sync.
 */
// check in checkout hours are in WIB (UTC+7) and are used to compute the validity window of
// Delete this for setting later
export const HOMESTAY_CHECK_IN_HOUR = 13;
export const HOMESTAY_CHECK_OUT_HOUR = 12;

/**
 * How far into the future a booking can be made. Enforced in the calendar
 * UI (src/components/ui/Calendar.tsx), the booking submission schema
 * (src/lib/validation/booking.ts), and re-checked wherever a date is
 * accepted server-side - never in only one of those places.
 */
export const MAX_BOOKING_DAYS_AHEAD = 90;

/** `YYYY-MM-DD` (WIB) form of the latest bookable date, given `today`. */
export function getMaxBookableDate(today: string) {
  const [year, month, day] = today.split("-").map(Number);
  const max = new Date(Date.UTC(year, month - 1, day));
  max.setUTCDate(max.getUTCDate() + MAX_BOOKING_DAYS_AHEAD);
  return max.toISOString().slice(0, 10);
}

const jakartaDateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Today's calendar date (YYYY-MM-DD) in the site's single operating
 * timezone (WIB). Always compute this on the server and pass it down as a
 * prop/serialized value - calling `new Date()` directly inside a Client
 * Component's render is what causes hydration mismatches (see
 * src/app/booking/payment/page.tsx for the fix and write-up).
 */
export function getTodayInJakarta() {
  return jakartaDateFormatter.format(new Date());
}

/** Minutes a signed evidence/profile URL stays valid for (docs/STORAGE.md). */
export const SIGNED_URL_TTL_SECONDS = 300;
