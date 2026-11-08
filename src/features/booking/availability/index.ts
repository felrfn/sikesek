import { prisma } from "@/lib/prisma";
import { isDateClosedForBooking } from "@/lib/pricing";
import { getTodayInJakarta } from "@/lib/siteConfig";
import { hourRangesOverlap } from "../categories/shared";
import { loadEdutripAvailability } from "./edutrip";
import { loadHomestayAvailability } from "./homestay";
import { pickRentalWindowToReport, resolveAvailability, resolveRentalStatus, dateKeyOf } from "./status";
import type {
  FacilityAvailability,
  FacilityAvailabilityByDate,
  FacilityAvailabilityRangeQuery,
  FacilityCategoryName,
  FacilityRentalStatus,
} from "./types";
import { loadVenueAvailability } from "./venue";

export type {
  FacilityAvailability,
  FacilityAvailabilityByDate,
  FacilityAvailabilityRangeQuery,
  FacilityAvailabilityStatus,
  FacilityCategoryName,
  FacilityRentalStatus,
  FacilityUnavailabilityReason,
} from "./types";

/**
 * Availability for every facility (or just one category) across a date
 * range `[startDate, endDate]` (inclusive) - the core the mobile app's
 * `facilities/availability` endpoint is built on
 * (docs/MOBILE_API.md#facility-availability). `getFacilityAvailability`
 * below is a thin single-day wrapper over this, so a single-date query and
 * a range query can never drift into two different definitions of
 * "available" - reusing the exact same blocking-status constants and
 * overlap predicate `checkAvailability`/`createBookingTransaction` use, so
 * "unavailable" means the same thing here as it does at actual booking
 * time.
 *
 * Runs a fixed, small number of queries regardless of how many days or
 * facilities are involved: one `findMany` per facility category, one
 * batched conflict lookup per category covering the *entire* range at
 * once (not one query per day), grouped back out per day in memory.
 *
 * For whichever date in the range is "today" (Asia/Jakarta), a homestay or
 * venue currently blocked by a `CHECKED_IN` booking also gets a `rental`
 * block, computed fresh from that booking's own dates via
 * `getHomestayRentalWindow`/`getVenueRentalWindow` (src/lib/bookingWindow.ts)
 * rather than by reading `Ticket.validFrom`/`validUntil` off a joined
 * Ticket row - an admin can force a booking to `CHECKED_IN` with no Ticket
 * at all (see `adminCheckIn`), so deriving the window from the booking
 * itself is both more efficient (no extra join) and correct in that case
 * too. `rental` is `null` for every other day/facility/category - edutrip
 * is now the same kind of exclusive daily slot as homestay/venue (see its
 * `ALREADY_BOOKED` conflict below), so "occupied" applies to it as well.
 *
 * Homestay monitoring vs. booking truth are deliberately split: `status`/
 * `reason` (and every real booking-conflict check) use the exact-match
 * `checkInDate` rule, so a new night is never blocked or freed by this
 * endpoint's monitoring needs. `rental` additionally surfaces a CHECKED_IN
 * stay on its checkout day and while overdue past `endAt` (until COMPLETED),
 * so field officers can always find the `bookingId` they need to check out.
 *
 * `startHour`/`endHour` are optional for venues - without them, a venue's
 * `status`/`reason` only reflects being inactive or holiday-closed, not a
 * specific time-slot conflict (there's no single slot to check against);
 * `rental` is unaffected either way, since it reflects the booking's own
 * recorded time, not the query's filter.
 */
export async function getFacilityAvailabilityRange(
  query: FacilityAvailabilityRangeQuery,
): Promise<FacilityAvailabilityByDate[]> {
  const startDay = new Date(`${query.startDate}T00:00:00.000Z`);
  const endDay = new Date(`${query.endDate}T00:00:00.000Z`);
  const now = new Date();
  const todayKey = getTodayInJakarta();

  const holidays = await prisma.holiday.findMany();

  const includeHomestay = !query.category || query.category === "homestay";
  const includeVenue = !query.category || query.category === "venue";
  const includeEdutrip = !query.category || query.category === "edutrip";

  const [homestays, venues, edutrips] = await Promise.all([
    includeHomestay
      ? prisma.homestay.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true },
        })
      : [],
    includeVenue
      ? prisma.venue.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true },
        })
      : [],
    includeEdutrip
      ? prisma.edutripPackage.findMany({
          where: { deletedAt: null },
          select: { id: true, name: true, isActive: true },
        })
      : [],
  ]);

  const rangeIncludesToday =
    query.startDate <= todayKey && todayKey <= query.endDate;

  const [homestayAvailability, venueAvailability, edutripAvailability] = await Promise.all([
    loadHomestayAvailability({
      homestays,
      startDay,
      endDay,
      now,
      todayKey,
      rangeIncludesToday,
    }),
    loadVenueAvailability({ venues, startDay, endDay, now }),
    loadEdutripAvailability({ edutrips, startDay, endDay, now }),
  ]);

  const results: FacilityAvailabilityByDate[] = [];

  for (
    const day = new Date(startDay);
    day.getTime() <= endDay.getTime();
    day.setUTCDate(day.getUTCDate() + 1)
  ) {
    const dateKey = dateKeyOf(day);
    const closedForHoliday = isDateClosedForBooking(day, holidays);
    const isToday = dateKey === todayKey;
    const facilities: FacilityAvailability[] = [];

    for (const homestay of homestays) {
      const key = `${homestay.id}|${dateKey}`;
      let rental: FacilityRentalStatus | null = null;
      if (isToday) {
        const active = pickRentalWindowToReport(
          now,
          homestayAvailability.checkedInByDate.get(key) ?? [],
        );
        if (active) rental = resolveRentalStatus(now, active);
      }
      facilities.push({
        id: homestay.id,
        category: "homestay",
        name: homestay.name,
        ...resolveAvailability(
          homestay.isActive,
          closedForHoliday,
          homestayAvailability.bookedKeys.has(key) ? "ALREADY_BOOKED" : null,
        ),
        rental,
      });
    }

    for (const venue of venues) {
      const key = `${venue.id}|${dateKey}`;
      const hasTimeConflict =
        query.startHour !== undefined && query.endHour !== undefined
          ? (venueAvailability.bookingHoursByDate.get(key) ?? []).some((booked) =>
              hourRangesOverlap(booked.startHour, booked.endHour, query.startHour!, query.endHour!),
            )
          : false;

      let rental: FacilityRentalStatus | null = null;
      if (isToday) {
        const active = pickRentalWindowToReport(now, venueAvailability.checkedInByDate.get(key) ?? []);
        if (active) rental = resolveRentalStatus(now, active);
      }

      facilities.push({
        id: venue.id,
        category: "venue",
        name: venue.name,
        ...resolveAvailability(
          venue.isActive,
          closedForHoliday,
          hasTimeConflict ? "ALREADY_BOOKED" : null,
        ),
        rental,
      });
    }

    for (const pkg of edutrips) {
      const edutripKey = pkg.id + "|" + dateKey;
      let rental: FacilityRentalStatus | null = null;
      if (isToday) {
        const active = pickRentalWindowToReport(now, edutripAvailability.checkedInByDate.get(edutripKey) ?? []);
        if (active) rental = resolveRentalStatus(now, active);
      }

      facilities.push({
        id: pkg.id,
        category: "edutrip",
        name: pkg.name,
        ...resolveAvailability(
          pkg.isActive,
          closedForHoliday,
          edutripAvailability.bookedKeys.has(edutripKey) ? "ALREADY_BOOKED" : null,
        ),
        rental,
      });
    }

    results.push({ date: dateKey, facilities });
  }

  return results;
}

/**
 * Single-day convenience wrapper over `getFacilityAvailabilityRange` - kept
 * so a single-`date` query keeps returning the exact flat `facilities`
 * array it always has (no response-shape change for existing callers).
 */
export async function getFacilityAvailability(query: {
  date: string;
  category?: FacilityCategoryName;
  startHour?: number;
  endHour?: number;
}): Promise<FacilityAvailability[]> {
  const [day] = await getFacilityAvailabilityRange({
    startDate: query.date,
    endDate: query.date,
    category: query.category,
    startHour: query.startHour,
    endHour: query.endHour,
  });
  return day.facilities;
}
