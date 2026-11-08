import type {
  FacilityAvailabilityStatus,
  FacilityRentalStatus,
  FacilityUnavailabilityReason,
} from "./types";

export function resolveAvailability(
  isActive: boolean,
  closedForHoliday: boolean,
  unavailableReason: FacilityUnavailabilityReason | null,
): { status: FacilityAvailabilityStatus; reason: FacilityUnavailabilityReason | null } {
  if (!isActive) return { status: "UNAVAILABLE", reason: "INACTIVE" };
  if (closedForHoliday) return { status: "UNAVAILABLE", reason: "CLOSED_HOLIDAY" };
  if (unavailableReason) return { status: "UNAVAILABLE", reason: unavailableReason };
  return { status: "AVAILABLE", reason: null };
}

export function resolveRentalStatus(
  now: Date,
  booking: { bookingId: string; customerName: string; validFrom: Date; validUntil: Date },
): FacilityRentalStatus {
  const { bookingId, customerName, validFrom, validUntil } = booking;
  const isExpired = now > validUntil;
  const isOccupied = !isExpired && now >= validFrom;
  return {
    isOccupied,
    bookingId,
    customerName,
    startAt: validFrom.toISOString(),
    endAt: validUntil.toISOString(),
    remainingSeconds: isOccupied
      ? Math.max(0, Math.round((validUntil.getTime() - now.getTime()) / 1000))
      : null,
    isExpired,
  };
}

export function dateKeyOf(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Of a CHECKED_IN booking's possibly-several rental windows for one
 * facility on one day (e.g. two non-overlapping venue slots both checked in
 * at different points today), picks the one worth reporting, in order:
 *
 *  1. whichever window `now` actually falls inside (the active rental);
 *  2. otherwise the most recently *expired* one, so an overdue checkout is
 *     still surfaced rather than silently dropped;
 *  3. otherwise the earliest one that hasn't started yet.
 *
 * Case 3 matters because `CHECKED_IN` is set by a human (a QR scan, or an
 * admin force-checking someone in early via `adminCheckIn`) and is the real
 * signal that a visitor is physically present - it does not wait for the
 * nominal check-in hour. Dropping that case would return `rental: null` for
 * a facility that genuinely has someone in it, which hides the `bookingId`
 * the field officer needs to check them out at all.
 *
 * Two windows can't both contain `now` at once: the booking-conflict rules
 * already prevent two overlapping CHECKED_IN windows for the same facility.
 */
export function pickRentalWindowToReport<T extends { validFrom: Date; validUntil: Date }>(
  now: Date,
  candidates: T[],
): T | undefined {
  const current = candidates.find((c) => now >= c.validFrom && now <= c.validUntil);
  if (current) return current;

  const expired = candidates.filter((c) => now > c.validUntil);
  if (expired.length > 0) {
    return expired.reduce((latest, c) => (c.validUntil > latest.validUntil ? c : latest));
  }

  const upcoming = candidates.filter((c) => now < c.validFrom);
  if (upcoming.length === 0) return undefined;
  return upcoming.reduce((earliest, c) => (c.validFrom < earliest.validFrom ? c : earliest));
}
