/**
 * Public entry point for the booking feature.
 *
 * The implementation is split by responsibility:
 * - `categories/*`     - per-category pricing, conflict checks, and create data
 * - `availabilityCheck.ts` - advisory pre-check used by the booking page
 * - `createBooking.ts` - authoritative booking creation (Serializable tx)
 * - `availability.ts`  - facility availability/rental read model (mobile API)
 * - `queries.ts`       - read queries
 *
 * Everything is re-exported here so callers keep importing from
 * `@/features/booking/service` exactly as before.
 */
export { BookingError, BookingConflictError } from "./errors";
export { checkAvailability, type AvailabilityConflict } from "./availabilityCheck";
export { createBookingTransaction } from "./createBooking";
export { getTransactionByInvoice } from "./queries";
export {
  getFacilityAvailability,
  getFacilityAvailabilityRange,
  type FacilityAvailability,
  type FacilityAvailabilityByDate,
  type FacilityAvailabilityRangeQuery,
  type FacilityAvailabilityStatus,
  type FacilityCategoryName,
  type FacilityRentalStatus,
  type FacilityUnavailabilityReason,
} from "./availability";
