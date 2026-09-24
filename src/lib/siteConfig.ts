/**
 * Shared operational constants shown across the public site (facility
 * cards) and used to compute ticket validity windows. Centralized here so
 * the two stay in sync.
 */
export const HOMESTAY_CHECK_IN_HOUR = 14;
export const HOMESTAY_CHECK_OUT_HOUR = 12;

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
