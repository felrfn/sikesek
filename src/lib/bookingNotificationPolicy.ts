/**
 * Facility-booking reminder policy, centralized so the cron service and its
 * tests share exactly one definition of "15 minutes before the rental ends"
 * and "normal hotel check-in grace".
 */
export const BOOKING_ENDING_SOON = "BOOKING_ENDING_SOON" as const;
export const BOOKING_CHECKIN_OVERDUE = "BOOKING_CHECKIN_OVERDUE" as const;

export type BookingReminderEventType =
  | typeof BOOKING_ENDING_SOON
  | typeof BOOKING_CHECKIN_OVERDUE;

export const RENTAL_ENDING_SOON_MINUTES = 15;

/**
 * Normal hotel practice is to hold a room for a few hours after the official
 * check-in time; for this operational app, two hours is actionable without
 * waiting until midnight. The official homestay check-in hour is 13:00 WIB,
 * so this means the no-show reminder fires at 15:00 WIB.
 */
export const HOMESTAY_CHECK_IN_GRACE_MINUTES = 120;

/** Venue rentals are hourly, so a 15-minute grace is already a full no-show window for short bookings. */
export const VENUE_CHECK_IN_GRACE_MINUTES = 15;

export function rentalEndingSoonAt(validUntil: Date) {
  return new Date(
    validUntil.getTime() - RENTAL_ENDING_SOON_MINUTES * 60_000,
  );
}

export function getCheckInDeadline(
  bookingType: "homestay" | "venue",
  validFrom: Date,
) {
  const graceMinutes =
    bookingType === "homestay"
      ? HOMESTAY_CHECK_IN_GRACE_MINUTES
      : VENUE_CHECK_IN_GRACE_MINUTES;

  return new Date(validFrom.getTime() + graceMinutes * 60_000);
}
