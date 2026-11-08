import { HOMESTAY_CHECK_IN_HOUR, HOMESTAY_CHECK_OUT_HOUR } from "@/lib/siteConfig";

/**
 * The single definition of a booking's rental/validity window - from and
 * until when a visitor's stay/usage is considered active. Used both to
 * stamp `Ticket.validFrom`/`validUntil` at ticket-creation time
 * (`features/tickets/service.ts`) and to compute live remaining-time for
 * the mobile availability endpoint (`features/booking/availability/`) - a
 * booking's rental period is defined exactly once here, not recomputed
 * differently in two places.
 *
 * Every other date/hour in this codebase (booking dates, `startHour`/
 * `endHour`, `Venue.startTime`/`endTime`) is a WIB wall-clock value stored
 * with its hour written directly via `setUTCHours`/`T..:00:00.000Z` - never
 * translated to a true UTC offset - because it's only ever compared against
 * other values built the exact same way (e.g. `hourRangesOverlap` comparing
 * two `startHour`s). That convention breaks down specifically here, because
 * `validFrom`/`validUntil` get compared against a *real* wall-clock instant
 * (`new Date()` in `features/tickets/service.ts` and
 * `features/booking/availability/`'s rental countdown) - so this is the one
 * place that must produce a true UTC instant, by subtracting WIB's UTC+7
 * offset, or a WIB "13:00" check-in reads as 13:00 UTC (= 20:00 WIB) and a
 * ticket stays "not valid yet" for 7 extra hours.
 */
const WIB_UTC_OFFSET_HOURS = 7;

function atHour(date: Date, hour: number) {
  const d = new Date(date);
  d.setUTCHours(hour - WIB_UTC_OFFSET_HOURS, 0, 0, 0);
  return d;
}

function combineDateAndTime(date: Date, time: Date) {
  const d = new Date(date);
  d.setUTCHours(time.getUTCHours() - WIB_UTC_OFFSET_HOURS, time.getUTCMinutes(), 0, 0);
  return d;
}

export function getHomestayRentalWindow(checkInDate: Date, checkOutDate: Date) {
  return {
    validFrom: atHour(checkInDate, HOMESTAY_CHECK_IN_HOUR),
    validUntil: atHour(checkOutDate, HOMESTAY_CHECK_OUT_HOUR),
  };
}

export function getVenueRentalWindow(bookingDate: Date, startTime: Date, endTime: Date) {
  return {
    validFrom: combineDateAndTime(bookingDate, startTime),
    validUntil: combineDateAndTime(bookingDate, endTime),
  };
}

export function getEdutripRentalWindow(visitDate: Date) {
  return { validFrom: atHour(visitDate, 8), validUntil: atHour(visitDate, 17) };
}
