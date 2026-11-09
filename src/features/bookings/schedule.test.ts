import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  barVariant,
  buildDays,
  diffDays,
  endOfMonthKey,
  groupAndMergeBookings,
  isValidDateKey,
  layoutSchedule,
  rangeForView,
  rangeLabel,
  shiftRange,
  startOfMonthKey,
  startOfWeekKey,
  type RawScheduleBooking,
  type ScheduleFacility,
} from "./schedule";

const facility: ScheduleFacility = {
  id: "h1",
  name: "AREN 1",
  meta: "1 kamar",
  isActive: true,
};

function booking(overrides: Partial<RawScheduleBooking>): RawScheduleBooking {
  return {
    bookingId: "b1",
    transactionId: "t1",
    bookingType: "homestay",
    facilityId: "h1",
    customerName: "Budi",
    invoiceNumber: "INV-1",
    bookingStatus: "CONFIRMED",
    paymentStatus: "PAID",
    paymentOverdue: false,
    startKey: "2026-11-10",
    endKey: "2026-11-11",
    ...overrides,
  };
}

describe("date key helpers", () => {
  it("validates real ISO date keys only", () => {
    expect(isValidDateKey("2026-11-08")).toBe(true);
    expect(isValidDateKey("2026-02-30")).toBe(false);
    expect(isValidDateKey("08-11-2026")).toBe(false);
    expect(isValidDateKey(undefined)).toBe(false);
  });

  it("adds days across month boundaries", () => {
    expect(addDaysKey("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDaysKey("2026-12-01", -1)).toBe("2026-11-30");
  });

  it("computes whole-day differences", () => {
    expect(diffDays("2026-11-01", "2026-11-30")).toBe(29);
    expect(diffDays("2026-11-30", "2026-11-01")).toBe(-29);
  });

  it("starts weeks on Monday", () => {
    // 2026-11-08 is a Sunday -> the week started Monday 2026-11-02.
    expect(startOfWeekKey("2026-11-08")).toBe("2026-11-02");
    expect(startOfWeekKey("2026-11-02")).toBe("2026-11-02");
    expect(startOfWeekKey("2026-11-05")).toBe("2026-11-02");
  });

  it("computes month boundaries", () => {
    expect(startOfMonthKey("2026-11-08")).toBe("2026-11-01");
    expect(endOfMonthKey("2026-11-08")).toBe("2026-11-30");
    expect(endOfMonthKey("2026-02-10")).toBe("2026-02-28");
  });
});

describe("rangeForView", () => {
  it("returns a single day for the day view", () => {
    expect(rangeForView("day", "2026-11-08")).toEqual({
      from: "2026-11-08",
      to: "2026-11-08",
    });
  });

  it("returns Monday-Sunday for the week view", () => {
    expect(rangeForView("week", "2026-11-08")).toEqual({
      from: "2026-11-02",
      to: "2026-11-08",
    });
  });

  it("returns the full month for the month view", () => {
    expect(rangeForView("month", "2026-11-08")).toEqual({
      from: "2026-11-01",
      to: "2026-11-30",
    });
  });
});

describe("shiftRange", () => {
  it("moves a week by seven days", () => {
    expect(shiftRange("week", "2026-11-02", 1)).toEqual({
      from: "2026-11-09",
      to: "2026-11-15",
    });
    expect(shiftRange("week", "2026-11-02", -1)).toEqual({
      from: "2026-10-26",
      to: "2026-11-01",
    });
  });

  it("moves a month to the neighbouring month", () => {
    expect(shiftRange("month", "2026-11-01", 1)).toEqual({
      from: "2026-12-01",
      to: "2026-12-31",
    });
    expect(shiftRange("month", "2026-01-01", -1)).toEqual({
      from: "2025-12-01",
      to: "2025-12-31",
    });
  });
});

describe("buildDays", () => {
  it("marks weekends, today and holidays", () => {
    const days = buildDays("2026-11-06", "2026-11-09", "2026-11-08", [
      { dateKey: "2026-11-07", name: "Libur", isClosed: true },
    ]);

    expect(days).toHaveLength(4);
    expect(days[0]).toMatchObject({ key: "2026-11-06", isWeekend: false });
    expect(days[1]).toMatchObject({
      key: "2026-11-07",
      isWeekend: true,
      holidayName: "Libur",
      isClosedHoliday: true,
    });
    expect(days[2]).toMatchObject({ key: "2026-11-08", isWeekend: true, isToday: true });
    expect(days[3]).toMatchObject({ key: "2026-11-09", isWeekend: false });
  });
});

describe("rangeLabel", () => {
  it("labels month, week and day ranges", () => {
    expect(rangeLabel("month", "2026-11-01", "2026-11-30")).toBe("November 2026");
    expect(rangeLabel("week", "2026-11-02", "2026-11-08")).toBe("2 - 8 Nov 2026");
    expect(rangeLabel("week", "2026-11-30", "2026-12-06")).toBe(
      "30 Nov 2026 - 6 Des 2026",
    );
    expect(rangeLabel("day", "2026-11-08", "2026-11-08")).toBe(
      "Minggu, 8 November 2026",
    );
  });
});

describe("groupAndMergeBookings", () => {
  it("merges contiguous nights of the same stay into one bar", () => {
    const merged = groupAndMergeBookings([
      booking({ bookingId: "n1", startKey: "2026-11-10", endKey: "2026-11-11" }),
      booking({ bookingId: "n2", startKey: "2026-11-11", endKey: "2026-11-12" }),
      booking({ bookingId: "n3", startKey: "2026-11-12", endKey: "2026-11-13" }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      startKey: "2026-11-10",
      endKey: "2026-11-13",
      nights: 3,
    });
    expect(merged[0].lines.map((l) => l.bookingId)).toEqual(["n1", "n2", "n3"]);
  });

  it("does not merge a gap between nights", () => {
    const merged = groupAndMergeBookings([
      booking({ bookingId: "n1", startKey: "2026-11-10", endKey: "2026-11-11" }),
      booking({ bookingId: "n2", startKey: "2026-11-12", endKey: "2026-11-13" }),
    ]);

    expect(merged).toHaveLength(2);
  });

  it("splits a stay when a night has a different booking status", () => {
    const merged = groupAndMergeBookings([
      booking({ bookingId: "n1", startKey: "2026-11-10", endKey: "2026-11-11" }),
      booking({
        bookingId: "n2",
        startKey: "2026-11-11",
        endKey: "2026-11-12",
        bookingStatus: "CANCELLED",
      }),
    ]);

    expect(merged.map((m) => m.bookingStatus)).toEqual(["CONFIRMED", "CANCELLED"]);
  });

  it("keeps venue bookings as individual bars", () => {
    const merged = groupAndMergeBookings([
      booking({
        bookingType: "venue",
        bookingId: "v1",
        startKey: "2026-11-10",
        endKey: "2026-11-10",
        startHour: 9,
        endHour: 12,
      }),
    ]);

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({ startHour: 9, endHour: 12 });
  });
});

describe("layoutSchedule", () => {
  const days = buildDays("2026-11-01", "2026-11-30", "2026-11-08");

  it("places a multi-day stay across its day span", () => {
    const merged = groupAndMergeBookings([
      booking({ bookingId: "n1", startKey: "2026-11-09", endKey: "2026-11-10" }),
      booking({ bookingId: "n2", startKey: "2026-11-10", endKey: "2026-11-11" }),
    ]);
    const [row] = layoutSchedule([facility], merged, days);

    expect(row.bars).toHaveLength(1);
    expect(row.bars[0].startUnits).toBe(8); // 9 Nov is index 8
    expect(row.bars[0].endUnits).toBe(10);
    expect(row.bars[0].nights).toBe(2);
  });

  it("clamps bars that start before or end after the visible range", () => {
    const [row] = layoutSchedule(
      [facility],
      groupAndMergeBookings([
        booking({ startKey: "2026-10-25", endKey: "2026-11-02" }),
        booking({
          bookingId: "b2",
          startKey: "2026-11-29",
          endKey: "2026-12-03",
        }),
      ]),
      days,
    );

    expect(row.bars[0]).toMatchObject({
      startUnits: 0,
      endUnits: 1,
      clippedStart: true,
      clippedEnd: false,
    });
    expect(row.bars[1]).toMatchObject({
      startUnits: 28,
      endUnits: 30,
      clippedStart: false,
      clippedEnd: true,
    });
  });

  it("drops bookings entirely outside the visible range", () => {
    const [row] = layoutSchedule(
      [facility],
      groupAndMergeBookings([
        booking({ startKey: "2026-12-05", endKey: "2026-12-06" }),
      ]),
      days,
    );

    expect(row.bars).toHaveLength(0);
  });

  it("positions venue bars by hour within their day", () => {
    const [row] = layoutSchedule(
      [facility],
      groupAndMergeBookings([
        booking({
          bookingType: "venue",
          startKey: "2026-11-10",
          endKey: "2026-11-10",
          startHour: 9,
          endHour: 12,
        }),
      ]),
      days,
    );

    expect(row.bars[0].startUnits).toBeCloseTo(9 + 9 / 24);
    expect(row.bars[0].endUnits).toBeCloseTo(9 + 12 / 24);
  });

  it("stacks overlapping bookings into separate lanes", () => {
    const [row] = layoutSchedule(
      [facility],
      groupAndMergeBookings([
        booking({ bookingId: "b1", startKey: "2026-11-10", endKey: "2026-11-13" }),
        booking({ bookingId: "b2", startKey: "2026-11-11", endKey: "2026-11-12" }),
      ]),
      days,
    );

    expect(row.lanes).toBe(2);
    expect(row.bars.map((b) => b.lane)).toEqual([0, 1]);
  });

  it("reuses a lane once a booking has ended", () => {
    const [row] = layoutSchedule(
      [facility],
      groupAndMergeBookings([
        booking({
          bookingId: "b1",
          transactionId: "t1",
          startKey: "2026-11-10",
          endKey: "2026-11-11",
        }),
        booking({
          bookingId: "b2",
          transactionId: "t2",
          startKey: "2026-11-11",
          endKey: "2026-11-12",
        }),
      ]),
      days,
    );

    expect(row.lanes).toBe(1);
    expect(row.bars.map((b) => b.lane)).toEqual([0, 0]);
  });
});

describe("barVariant", () => {
  it("maps bookings to their visual state", () => {
    expect(barVariant({ bookingStatus: "PENDING", paymentStatus: "PENDING" })).toBe("pending");
    expect(barVariant({ bookingStatus: "PENDING", paymentStatus: "PAID" })).toBe("pendingPaid");
    expect(barVariant({ bookingStatus: "CONFIRMED", paymentStatus: "PAID" })).toBe("confirmed");
    expect(barVariant({ bookingStatus: "CHECKED_IN", paymentStatus: "PAID" })).toBe("checkedIn");
    expect(barVariant({ bookingStatus: "COMPLETED", paymentStatus: "PAID" })).toBe("completed");
    expect(barVariant({ bookingStatus: "CANCELLED", paymentStatus: "PAID" })).toBe("cancelled");
  });
});
