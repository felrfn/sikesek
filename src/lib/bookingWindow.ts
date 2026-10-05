import { HOMESTAY_CHECK_IN_HOUR, HOMESTAY_CHECK_OUT_HOUR } from "@/lib/siteConfig";

/**
 * The single definition of a booking's rental/validity window - from and
 * until when a visitor's stay/usage is considered active. Used both to
 * stamp `Ticket.validFrom`/`validUntil` at ticket-creation time
 * (`features/tickets/service.ts`) and to compute live remaining-time for
 * the mobile availability endpoint (`features/booking/service.ts`) - a
 * booking's rental period is defined exactly once here, not recomputed
 * differently in two places.
 *
 * The hour constants are applied via `setUTCHours` on dates that are
 * themselves UTC-midnight representations of a WIB calendar day (see
 * `getTodayInJakarta`/`dateField` elsewhere in this codebase) - this
 * matches how every other date in the app is constructed and compared, and
 * must not be "corrected" to a true UTC offset without auditing every other
 * date computation in the codebase at the same time.
 */
function atHour(date: Date, hour: number) {
  const d = new Date(date);
  d.setUTCHours(hour, 0, 0, 0);
  return d;
}

function combineDateAndTime(date: Date, time: Date) {
  const d = new Date(date);
  d.setUTCHours(time.getUTCHours(), time.getUTCMinutes(), 0, 0);
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
  return { validFrom: atHour(visitDate, 0), validUntil: atHour(visitDate, 23) };
}
