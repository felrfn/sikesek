/**
 * Pure date/geometry helpers for the admin reservation Gantt chart
 * (`/admin/bookings`). Everything here is UI-agnostic and equally usable on
 * the server (building the schedule from Prisma rows) and in the browser
 * (range navigation links), so it deliberately has no Prisma/React imports.
 *
 * All calendar dates are WIB wall-clock dates, represented as `YYYY-MM-DD`
 * keys - the same convention the rest of the booking code uses. Date maths is
 * done on UTC midnights so a server running outside WIB can't shift a day.
 */

export type ScheduleBookingType = "homestay" | "venue" | "edutrip";
export type ScheduleView = "day" | "week" | "month";

const DAY_MS = 24 * 60 * 60 * 1000;

export function keyToUtcDate(key: string): Date {
  return new Date(`${key}T00:00:00.000Z`);
}

export function dateToKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDaysKey(key: string, days: number): string {
  const date = keyToUtcDate(key);
  date.setUTCDate(date.getUTCDate() + days);
  return dateToKey(date);
}

/** Whole-day difference `to - from` (negative when `to` is before `from`). */
export function diffDays(fromKey: string, toKey: string): number {
  return Math.round((keyToUtcDate(toKey).getTime() - keyToUtcDate(fromKey).getTime()) / DAY_MS);
}

export function isValidDateKey(value: string | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = keyToUtcDate(value);
  return !Number.isNaN(date.getTime()) && dateToKey(date) === value;
}

/** Monday-based start of the week containing `key`. */
export function startOfWeekKey(key: string): string {
  const date = keyToUtcDate(key);
  const weekday = date.getUTCDay(); // 0 = Sunday
  const delta = weekday === 0 ? -6 : 1 - weekday;
  date.setUTCDate(date.getUTCDate() + delta);
  return dateToKey(date);
}

export function startOfMonthKey(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

export function endOfMonthKey(key: string): string {
  const date = keyToUtcDate(startOfMonthKey(key));
  date.setUTCMonth(date.getUTCMonth() + 1);
  date.setUTCDate(0);
  return dateToKey(date);
}

export interface DateRangeKeys {
  from: string;
  to: string;
}

/**
 * The default visible range for a view, anchored on `anchorKey`:
 * a single day, the Monday-Sunday week containing it, or the whole month.
 */
export function rangeForView(view: ScheduleView, anchorKey: string): DateRangeKeys {
  if (view === "day") return { from: anchorKey, to: anchorKey };
  if (view === "week") {
    const from = startOfWeekKey(anchorKey);
    return { from, to: addDaysKey(from, 6) };
  }
  return { from: startOfMonthKey(anchorKey), to: endOfMonthKey(anchorKey) };
}

/** Move one range-length forward/backward. */
export function shiftRange(
  view: ScheduleView,
  fromKey: string,
  direction: -1 | 1,
): DateRangeKeys {
  if (view === "day") return rangeForView("day", addDaysKey(fromKey, direction));
  if (view === "week") return rangeForView("week", addDaysKey(fromKey, direction * 7));
  const date = keyToUtcDate(startOfMonthKey(fromKey));
  date.setUTCMonth(date.getUTCMonth() + direction);
  return rangeForView("month", dateToKey(date));
}

export interface ScheduleDay {
  key: string;
  dayOfMonth: number;
  /** 0 = Sunday ... 6 = Saturday */
  weekday: number;
  isWeekend: boolean;
  isToday: boolean;
  holidayName?: string;
  isClosedHoliday: boolean;
}

export interface ScheduleHoliday {
  dateKey: string;
  name: string;
  isClosed: boolean;
}

export function buildDays(
  fromKey: string,
  toKey: string,
  todayKey: string,
  holidays: ScheduleHoliday[] = [],
): ScheduleDay[] {
  const total = diffDays(fromKey, toKey) + 1;
  if (total <= 0) return [];

  const holidayByKey = new Map(holidays.map((h) => [h.dateKey, h]));

  return Array.from({ length: total }, (_, index) => {
    const key = addDaysKey(fromKey, index);
    const date = keyToUtcDate(key);
    const weekday = date.getUTCDay();
    const holiday = holidayByKey.get(key);
    return {
      key,
      dayOfMonth: date.getUTCDate(),
      weekday,
      isWeekend: weekday === 0 || weekday === 6,
      isToday: key === todayKey,
      holidayName: holiday?.name,
      isClosedHoliday: holiday?.isClosed ?? false,
    };
  });
}

const shortMonthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

const longMonthFormatter = new Intl.DateTimeFormat("id-ID", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const dayNumberFormatter = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  timeZone: "UTC",
});

const fullDateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Human label for the toolbar, computed on the server and passed down. */
export function rangeLabel(view: ScheduleView, fromKey: string, toKey: string): string {
  if (view === "month") return longMonthFormatter.format(keyToUtcDate(fromKey));
  if (view === "day") return fullDateFormatter.format(keyToUtcDate(fromKey));

  const from = keyToUtcDate(fromKey);
  const to = keyToUtcDate(toKey);
  const sameMonth = fromKey.slice(0, 7) === toKey.slice(0, 7);
  if (sameMonth) {
    return `${dayNumberFormatter.format(from)} - ${dayNumberFormatter.format(to)} ${shortMonthFormatter.format(to)}`;
  }
  return `${dayNumberFormatter.format(from)} ${shortMonthFormatter.format(from)} - ${dayNumberFormatter.format(to)} ${shortMonthFormatter.format(to)}`;
}

export interface ScheduleFacility {
  id: string;
  name: string;
  meta: string;
  isActive: boolean;
}

export interface RawScheduleBooking {
  bookingId: string;
  transactionId: string;
  bookingType: ScheduleBookingType;
  facilityId: string;
  customerName: string;
  invoiceNumber: string;
  bookingStatus: string;
  paymentStatus: string;
  /** A PENDING payment whose `paymentExpiresAt` has already passed. */
  paymentOverdue: boolean;
  /** Inclusive WIB date key (homestay check-in / venue booking date / visit date). */
  startKey: string;
  /** Exclusive WIB date key (homestay check-out; next day for single-day bookings). */
  endKey: string;
  /** Venue only - WIB wall-clock hours. */
  startHour?: number;
  endHour?: number;
  /** Homestay only - number of nights. */
  nights?: number;
  /** Edutrip only. */
  pax?: number;
}

export interface ScheduleBookingLine {
  bookingId: string;
  bookingStatus: string;
  startKey: string;
  endKey: string;
}

export interface ScheduleBooking {
  /** Representative id (the first underlying booking row). */
  id: string;
  transactionId: string;
  bookingType: ScheduleBookingType;
  facilityId: string;
  customerName: string;
  invoiceNumber: string;
  bookingStatus: string;
  paymentStatus: string;
  paymentOverdue: boolean;
  startKey: string;
  endKey: string;
  startHour?: number;
  endHour?: number;
  nights?: number;
  pax?: number;
  lines: ScheduleBookingLine[];
}

function toScheduleBooking(
  first: RawScheduleBooking,
  lines: RawScheduleBooking[],
): ScheduleBooking {
  const last = lines[lines.length - 1];
  return {
    id: first.bookingId,
    transactionId: first.transactionId,
    bookingType: first.bookingType,
    facilityId: first.facilityId,
    customerName: first.customerName,
    invoiceNumber: first.invoiceNumber,
    bookingStatus: first.bookingStatus,
    paymentStatus: first.paymentStatus,
    paymentOverdue: first.paymentOverdue,
    startKey: first.startKey,
    endKey: last.endKey,
    startHour: first.startHour,
    endHour: last.endHour ?? first.endHour,
    nights:
      first.bookingType === "homestay"
        ? lines.reduce((sum, line) => sum + (line.nights ?? 1), 0)
        : undefined,
    pax: first.pax,
    lines: lines.map((line) => ({
      bookingId: line.bookingId,
      bookingStatus: line.bookingStatus,
      startKey: line.startKey,
      endKey: line.endKey,
    })),
  };
}

/**
 * Homestay bookings are stored one night per row (`totalNights` is 1 for
 * every public-flow booking), so a multi-night stay is several adjacent rows
 * under one transaction. Merge those into a single visual bar so the Gantt
 * shows the actual stay length; split again if status/payment differ between
 * nights, since those need their own actions.
 */
export function groupAndMergeBookings(
  bookings: RawScheduleBooking[],
): ScheduleBooking[] {
  const result: ScheduleBooking[] = [];
  const homestaysByStay = new Map<string, RawScheduleBooking[]>();

  for (const booking of bookings) {
    if (booking.bookingType === "homestay") {
      const key = `${booking.facilityId}|${booking.transactionId}`;
      const group = homestaysByStay.get(key) ?? [];
      group.push(booking);
      homestaysByStay.set(key, group);
    } else {
      result.push(toScheduleBooking(booking, [booking]));
    }
  }

  for (const group of homestaysByStay.values()) {
    group.sort((a, b) => a.startKey.localeCompare(b.startKey));

    let run: RawScheduleBooking[] = [];
    for (const booking of group) {
      const previous = run[run.length - 1];
      const contiguous = previous ? previous.endKey === booking.startKey : false;
      const sameState =
        previous &&
        previous.bookingStatus === booking.bookingStatus &&
        previous.paymentStatus === booking.paymentStatus &&
        previous.paymentOverdue === booking.paymentOverdue;

      if (contiguous && sameState) {
        run.push(booking);
      } else {
        if (previous) result.push(toScheduleBooking(run[0], run));
        run = [booking];
      }
    }
    if (run.length > 0) result.push(toScheduleBooking(run[0], run));
  }

  return result;
}

export interface PositionedBar extends ScheduleBooking {
  /** First covered day index in the visible range. */
  dayIndex: number;
  /** Position in fractional day units from the start of the range. */
  startUnits: number;
  /** End in fractional day units (exclusive). */
  endUnits: number;
  lane: number;
  clippedStart: boolean;
  clippedEnd: boolean;
}

export interface ScheduleRow {
  facility: ScheduleFacility;
  lanes: number;
  bars: PositionedBar[];
}

/**
 * Places merged bookings on their facility row: clamps them to the visible
 * range and assigns each bar to the first free lane so overlapping bookings
 * stack instead of hiding each other.
 *
 * Venue bookings carry `startHour`/`endHour`, so their bar is offset within
 * its day column (or within the single 24-hour day view). Everything else
 * spans whole days via `startKey`/`endKey` (end exclusive).
 */
export function layoutSchedule(
  facilities: ScheduleFacility[],
  bookings: ScheduleBooking[],
  days: ScheduleDay[],
): ScheduleRow[] {
  if (days.length === 0) {
    return facilities.map((facility) => ({ facility, lanes: 0, bars: [] }));
  }

  const rangeStart = days[0].key;
  const dayCount = days.length;
  const barsByFacility = new Map<string, PositionedBar[]>();

  for (const booking of bookings) {
    const startOffset = diffDays(rangeStart, booking.startKey);
    let start = startOffset;
    let end = diffDays(rangeStart, booking.endKey);

    if (booking.startHour !== undefined && booking.endHour !== undefined) {
      start = startOffset + booking.startHour / 24;
      end = startOffset + booking.endHour / 24;
    }

    if (end <= 0 || start >= dayCount) continue;

    const clippedStart = start < 0;
    const clippedEnd = end > dayCount;
    start = Math.max(0, start);
    end = Math.min(dayCount, end);
    if (end - start <= 0) continue;

    const positioned: PositionedBar = {
      ...booking,
      dayIndex: Math.floor(start),
      startUnits: start,
      endUnits: end,
      lane: 0,
      clippedStart,
      clippedEnd,
    };

    const list = barsByFacility.get(booking.facilityId) ?? [];
    list.push(positioned);
    barsByFacility.set(booking.facilityId, list);
  }

  return facilities.map((facility) => {
    const bars = (barsByFacility.get(facility.id) ?? []).sort(
      (a, b) => a.startUnits - b.startUnits || a.endUnits - b.endUnits,
    );

    const laneEnds: number[] = [];
    for (const bar of bars) {
      let lane = laneEnds.findIndex((laneEnd) => laneEnd <= bar.startUnits + 1e-9);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(0);
      }
      laneEnds[lane] = bar.endUnits;
      bar.lane = lane;
    }

    return { facility, lanes: laneEnds.length, bars };
  });
}

export type BarVariant =
  | "pending"
  | "pendingPaid"
  | "confirmed"
  | "checkedIn"
  | "completed"
  | "cancelled";

/** What a bar's colour communicates: booking lifecycle + whether it needs action. */
export function barVariant(booking: {
  bookingStatus: string;
  paymentStatus: string;
}): BarVariant {
  if (booking.bookingStatus === "CANCELLED" || booking.bookingStatus === "REJECTED") {
    return "cancelled";
  }
  if (booking.bookingStatus === "PENDING") {
    return booking.paymentStatus === "PAID" ? "pendingPaid" : "pending";
  }
  if (booking.bookingStatus === "CHECKED_IN") return "checkedIn";
  if (booking.bookingStatus === "COMPLETED") return "completed";
  return "confirmed";
}

export const DEFAULT_VISIBLE_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
] as const;

export const ALL_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
  "CHECKED_IN",
  "COMPLETED",
  "CANCELLED",
  "REJECTED",
] as const;
