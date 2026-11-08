export type FacilityCategoryName = "homestay" | "venue" | "edutrip";
export type FacilityAvailabilityStatus = "AVAILABLE" | "UNAVAILABLE";
export type FacilityUnavailabilityReason = "INACTIVE" | "CLOSED_HOLIDAY" | "ALREADY_BOOKED";

/**
 * How much of a currently-occupied facility's rental period is left -
 * "occupied" meaning its blocking booking is `CHECKED_IN` *and* `now`
 * falls inside the same rental window `Ticket.validFrom`/`validUntil`
 * would be stamped with (src/lib/bookingWindow.ts). Only ever attached for
 * whichever date in the query is "today" (Asia/Jakarta) - a future date's
 * booking has no "remaining time" yet, and a past date's is moot.
 */
export interface FacilityRentalStatus {
  isOccupied: boolean;
  /** `TransactionHomestay`/`TransactionVenue`/`TransactionEdutrip` id - pass this straight to `POST /api/mobile/bookings/checkout`. */
  bookingId: string;
  /** The visitor's name on this booking's transaction (`Transaction.customerName`). */
  customerName: string;
  /** ISO 8601 - when this rental period started. */
  startAt: string;
  /** ISO 8601 - the authoritative checkout/expiration instant. */
  endAt: string;
  /** Seconds left until `endAt`, or `null` when not currently occupied. */
  remainingSeconds: number | null;
  /** `true` once `endAt` has passed, whether or not anyone has checked out yet. */
  isExpired: boolean;
}

export interface FacilityAvailability {
  id: string;
  category: FacilityCategoryName;
  name: string;
  status: FacilityAvailabilityStatus;
  reason: FacilityUnavailabilityReason | null;
  rental: FacilityRentalStatus | null;
}

export interface FacilityAvailabilityByDate {
  date: string;
  facilities: FacilityAvailability[];
}

export interface FacilityAvailabilityRangeQuery {
  startDate: string;
  endDate: string;
  category?: FacilityCategoryName;
  startHour?: number;
  endHour?: number;
}

/** Shared shape for a CHECKED_IN booking's rental window, used by every category loader and the result builder. */
export interface CheckedInWindow {
  bookingId: string;
  customerName: string;
  validFrom: Date;
  validUntil: Date;
}
