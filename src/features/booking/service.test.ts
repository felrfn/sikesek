import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const prismaMock = {
  holiday: { findMany: vi.fn() },
  homestay: { findMany: vi.fn() },
  venue: { findMany: vi.fn() },
  edutripPackage: { findMany: vi.fn() },
  transactionHomestay: { findMany: vi.fn() },
  transactionVenue: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getFacilityAvailability, getFacilityAvailabilityRange } = await import("./service");

function homestay(id: string, name: string, isActive = true) {
  return { id, name, isActive };
}
function venue(id: string, name: string, isActive = true) {
  return { id, name, isActive };
}
function edutrip(id: string, name: string, isActive = true) {
  return { id, name, isActive };
}
function hourDate(hour: number) {
  return new Date(`1970-01-01T${String(hour).padStart(2, "0")}:00:00.000Z`);
}

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.holiday.findMany.mockResolvedValue([]);
  prismaMock.homestay.findMany.mockResolvedValue([]);
  prismaMock.venue.findMany.mockResolvedValue([]);
  prismaMock.edutripPackage.findMany.mockResolvedValue([]);
  prismaMock.transactionHomestay.findMany.mockResolvedValue([]);
  prismaMock.transactionVenue.findMany.mockResolvedValue([]);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getFacilityAvailability (single date)", () => {
  it("reports a facility with no conflicts as available", async () => {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      {
        id: "h1",
        category: "homestay",
        name: "AREN 1",
        status: "AVAILABLE",
        reason: null,
        rental: null,
      },
    ]);
  });

  it("reports a deactivated facility as unavailable with reason INACTIVE, even with no bookings", async () => {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1", false)]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      {
        id: "h1",
        category: "homestay",
        name: "AREN 1",
        status: "UNAVAILABLE",
        reason: "INACTIVE",
        rental: null,
      },
    ]);
  });

  it("reports every category as unavailable with reason CLOSED_HOLIDAY on a closed date", async () => {
    prismaMock.holiday.findMany.mockResolvedValue([
      { date: new Date("2026-12-25T00:00:00.000Z"), isClosed: true },
    ]);
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);
    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.edutripPackage.findMany.mockResolvedValue([edutrip("e1", "Susur Sungai")]);

    const result = await getFacilityAvailability({ date: "2026-12-25" });

    expect(result).toEqual([
      {
        id: "h1",
        category: "homestay",
        name: "AREN 1",
        status: "UNAVAILABLE",
        reason: "CLOSED_HOLIDAY",
        rental: null,
      },
      {
        id: "v1",
        category: "venue",
        name: "Balai Pertemuan",
        status: "UNAVAILABLE",
        reason: "CLOSED_HOLIDAY",
        rental: null,
      },
      {
        id: "e1",
        category: "edutrip",
        name: "Susur Sungai",
        status: "UNAVAILABLE",
        reason: "CLOSED_HOLIDAY",
        rental: null,
      },
    ]);
  });

  it("prioritizes INACTIVE over CLOSED_HOLIDAY when both apply", async () => {
    prismaMock.holiday.findMany.mockResolvedValue([
      { date: new Date("2026-12-25T00:00:00.000Z"), isClosed: true },
    ]);
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1", false)]);

    const result = await getFacilityAvailability({ date: "2026-12-25" });

    expect(result[0].reason).toBe("INACTIVE");
  });

  it("reports a homestay already booked on that exact date as unavailable with reason ALREADY_BOOKED", async () => {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);
    prismaMock.transactionHomestay.findMany.mockResolvedValue([
      {
        homestayId: "h1",
        checkInDate: new Date("2026-10-10T00:00:00.000Z"),
        checkOutDate: new Date("2026-10-11T00:00:00.000Z"),
        bookingStatus: "CONFIRMED",
      },
    ]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      {
        id: "h1",
        category: "homestay",
        name: "AREN 1",
        status: "UNAVAILABLE",
        reason: "ALREADY_BOOKED",
        rental: null,
      },
    ]);
  });

  it("queries conflicts with the blocking booking/payment status filters, not just any transaction row", async () => {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);

    await getFacilityAvailability({ date: "2026-10-10" });

    const where = prismaMock.transactionHomestay.findMany.mock.calls[0][0].where;
    expect(where.bookingStatus.in).toEqual(["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"]);
    expect(where.transaction.paymentStatus.in).toEqual(["PENDING", "PAID"]);
    // Range-capable now, even for a single date - gte/lte collapsed to one day.
    expect(where.checkInDate.gte).toEqual(new Date("2026-10-10T00:00:00.000Z"));
    expect(where.checkInDate.lte).toEqual(new Date("2026-10-10T00:00:00.000Z"));
  });

  it("reports a venue as unavailable (ALREADY_BOOKED) when the requested hour range overlaps an existing booking", async () => {
    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      {
        venueId: "v1",
        bookingDate: new Date("2026-10-10T00:00:00.000Z"),
        startTime: hourDate(9),
        endTime: hourDate(11),
        bookingStatus: "CONFIRMED",
      },
    ]);

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 10,
      endHour: 12,
    });

    expect(result).toEqual([
      {
        id: "v1",
        category: "venue",
        name: "Balai Pertemuan",
        status: "UNAVAILABLE",
        reason: "ALREADY_BOOKED",
        rental: null,
      },
    ]);
  });

  it("reports a venue as available when the requested hour range does not overlap an existing booking", async () => {
    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      {
        venueId: "v1",
        bookingDate: new Date("2026-10-10T00:00:00.000Z"),
        startTime: hourDate(9),
        endTime: hourDate(11),
        bookingStatus: "CONFIRMED",
      },
    ]);

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 11,
      endHour: 13,
    });

    expect(result).toEqual([
      {
        id: "v1",
        category: "venue",
        name: "Balai Pertemuan",
        status: "AVAILABLE",
        reason: null,
        rental: null,
      },
    ]);
  });

  it("does not apply a time-conflict check to venues when startHour/endHour are omitted", async () => {
    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      {
        venueId: "v1",
        bookingDate: new Date("2026-10-10T00:00:00.000Z"),
        startTime: hourDate(0),
        endTime: hourDate(24),
        bookingStatus: "CONFIRMED",
      },
    ]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      {
        id: "v1",
        category: "venue",
        name: "Balai Pertemuan",
        status: "AVAILABLE",
        reason: null,
        rental: null,
      },
    ]);
  });

  it("never returns ALREADY_BOOKED for edutrip packages (pax-based, not exclusive)", async () => {
    prismaMock.edutripPackage.findMany.mockResolvedValue([edutrip("e1", "Susur Sungai")]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      {
        id: "e1",
        category: "edutrip",
        name: "Susur Sungai",
        status: "AVAILABLE",
        reason: null,
        rental: null,
      },
    ]);
    // No conflict table exists for edutrips - nothing to even query.
    expect(prismaMock.transactionHomestay.findMany).not.toHaveBeenCalled();
    expect(prismaMock.transactionVenue.findMany).not.toHaveBeenCalled();
  });

  it("only fetches and returns the requested category when `category` is given", async () => {
    await getFacilityAvailability({ date: "2026-10-10", category: "venue" });

    expect(prismaMock.homestay.findMany).not.toHaveBeenCalled();
    expect(prismaMock.edutripPackage.findMany).not.toHaveBeenCalled();
    expect(prismaMock.venue.findMany).toHaveBeenCalled();
  });
});

describe("getFacilityAvailabilityRange (date range)", () => {
  it("returns one entry per day, each with its own conflict resolution, from one batched query", async () => {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);
    prismaMock.transactionHomestay.findMany.mockResolvedValue([
      {
        homestayId: "h1",
        checkInDate: new Date("2026-10-11T00:00:00.000Z"),
        checkOutDate: new Date("2026-10-12T00:00:00.000Z"),
        bookingStatus: "CONFIRMED",
      },
    ]);

    const result = await getFacilityAvailabilityRange({
      startDate: "2026-10-10",
      endDate: "2026-10-12",
    });

    expect(result).toEqual([
      {
        date: "2026-10-10",
        facilities: [
          { id: "h1", category: "homestay", name: "AREN 1", status: "AVAILABLE", reason: null, rental: null },
        ],
      },
      {
        date: "2026-10-11",
        facilities: [
          {
            id: "h1",
            category: "homestay",
            name: "AREN 1",
            status: "UNAVAILABLE",
            reason: "ALREADY_BOOKED",
            rental: null,
          },
        ],
      },
      {
        date: "2026-10-12",
        facilities: [
          { id: "h1", category: "homestay", name: "AREN 1", status: "AVAILABLE", reason: null, rental: null },
        ],
      },
    ]);
    // One query covering the whole range, not one per day.
    expect(prismaMock.transactionHomestay.findMany).toHaveBeenCalledTimes(1);
    const where = prismaMock.transactionHomestay.findMany.mock.calls[0][0].where;
    expect(where.checkInDate).toEqual({
      gte: new Date("2026-10-10T00:00:00.000Z"),
      lte: new Date("2026-10-12T00:00:00.000Z"),
    });
  });
});

describe("getFacilityAvailability rental/occupancy status", () => {
  it("returns rental=null for an available (not currently occupied) facility", async () => {
    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result[0].rental).toBeNull();
  });

  it("reports an active rental with correct remaining time for a venue checked in today", async () => {
    vi.useFakeTimers();
    // startHour/endHour 9-11 are WIB wall-clock hours; the true UTC window
    // is 9-7=02:00Z to 11-7=04:00Z, so "now" must fall inside that.
    vi.setSystemTime(new Date("2026-10-10T03:00:00.000Z"));

    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      {
        id: "booking-1",
        venueId: "v1",
        bookingDate: new Date("2026-10-10T00:00:00.000Z"),
        startTime: hourDate(9),
        endTime: hourDate(11),
        bookingStatus: "CHECKED_IN",
        transaction: { customerName: "Jane Visitor" },
      },
    ]);

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 9,
      endHour: 11,
    });

    expect(result[0].status).toBe("UNAVAILABLE");
    expect(result[0].reason).toBe("ALREADY_BOOKED");
    expect(result[0].rental).toEqual({
      isOccupied: true,
      bookingId: "booking-1",
      customerName: "Jane Visitor",
      startAt: "2026-10-10T02:00:00.000Z",
      endAt: "2026-10-10T04:00:00.000Z",
      remainingSeconds: 3600,
      isExpired: false,
    });
  });

  it("reports a small remainingSeconds when the rental is ending soon", async () => {
    vi.useFakeTimers();
    // True UTC window ends at 04:00Z (see above) - one minute before that.
    vi.setSystemTime(new Date("2026-10-10T03:59:00.000Z"));

    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      {
        id: "booking-1",
        venueId: "v1",
        bookingDate: new Date("2026-10-10T00:00:00.000Z"),
        startTime: hourDate(9),
        endTime: hourDate(11),
        bookingStatus: "CHECKED_IN",
        transaction: { customerName: "Jane Visitor" },
      },
    ]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result[0].rental).toMatchObject({ isOccupied: true, isExpired: false, remainingSeconds: 60 });
  });

  it("reports isExpired=true and isOccupied=false, with remainingSeconds null, once the rental window has passed", async () => {
    vi.useFakeTimers();
    // True UTC window ends at 04:00Z (see above) - well after that.
    vi.setSystemTime(new Date("2026-10-10T05:00:00.000Z"));

    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      {
        id: "booking-1",
        venueId: "v1",
        bookingDate: new Date("2026-10-10T00:00:00.000Z"),
        startTime: hourDate(9),
        endTime: hourDate(11),
        bookingStatus: "CHECKED_IN",
        transaction: { customerName: "Jane Visitor" },
      },
    ]);

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 9,
      endHour: 11,
    });

    expect(result[0].rental).toEqual({
      isOccupied: false,
      bookingId: "booking-1",
      customerName: "Jane Visitor",
      startAt: "2026-10-10T02:00:00.000Z",
      endAt: "2026-10-10T04:00:00.000Z",
      remainingSeconds: null,
      isExpired: true,
    });
    // Still unavailable - an unchecked-out expired booking still blocks the slot.
    expect(result[0].status).toBe("UNAVAILABLE");
  });

  it("reports an active homestay rental computed from the booking's own check-in/out dates", async () => {
    vi.useFakeTimers();
    // HOMESTAY_CHECK_IN_HOUR=13 WIB -> true UTC 06:00 on the check-in day.
    vi.setSystemTime(new Date("2026-10-10T08:00:00.000Z"));

    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);
    prismaMock.transactionHomestay.findMany.mockResolvedValue([
      {
        id: "booking-2",
        homestayId: "h1",
        checkInDate: new Date("2026-10-10T00:00:00.000Z"),
        checkOutDate: new Date("2026-10-11T00:00:00.000Z"),
        bookingStatus: "CHECKED_IN",
        transaction: { customerName: "John Visitor" },
      },
    ]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    // HOMESTAY_CHECK_IN_HOUR=13 WIB (06:00Z) on check-in day,
    // HOMESTAY_CHECK_OUT_HOUR=12 WIB (05:00Z) on check-out day.
    expect(result[0].rental).toEqual({
      isOccupied: true,
      bookingId: "booking-2",
      customerName: "John Visitor",
      startAt: "2026-10-10T06:00:00.000Z",
      endAt: "2026-10-11T05:00:00.000Z",
      remainingSeconds: 21 * 3600,
      isExpired: false,
    });
  });

  it("still reports rental (with bookingId) for a guest checked in before the nominal check-in hour, so the officer can check them out", async () => {
    vi.useFakeTimers();
    // 08:33 WIB = 01:33Z, i.e. before the 13:00 WIB (06:00Z) check-in hour,
    // but the guest has already been checked in by an officer/admin.
    vi.setSystemTime(new Date("2026-10-09T01:33:00.000Z"));

    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);
    prismaMock.transactionHomestay.findMany.mockResolvedValue([
      {
        id: "booking-early",
        homestayId: "h1",
        checkInDate: new Date("2026-10-09T00:00:00.000Z"),
        checkOutDate: new Date("2026-10-10T00:00:00.000Z"),
        bookingStatus: "CHECKED_IN",
        transaction: { customerName: "Radja" },
      },
    ]);

    const result = await getFacilityAvailability({ date: "2026-10-09" });

    expect(result[0].status).toBe("UNAVAILABLE");
    expect(result[0].reason).toBe("ALREADY_BOOKED");
    // rental must NOT be null - that would hide the bookingId the checkout
    // endpoint needs. Not occupied yet, but present and identifiable.
    expect(result[0].rental).toEqual({
      isOccupied: false,
      bookingId: "booking-early",
      customerName: "Radja",
      startAt: "2026-10-09T06:00:00.000Z",
      endAt: "2026-10-10T05:00:00.000Z",
      remainingSeconds: null,
      isExpired: false,
    });
  });

  it("does not attach rental info to a day that isn't today, even for a CHECKED_IN booking", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T10:00:00.000Z")); // "today" is 2026-10-10

    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      {
        id: "booking-1",
        venueId: "v1",
        bookingDate: new Date("2026-10-12T00:00:00.000Z"), // a future day in the range
        startTime: hourDate(9),
        endTime: hourDate(11),
        bookingStatus: "CHECKED_IN",
        transaction: { customerName: "Jane Visitor" },
      },
    ]);

    const result = await getFacilityAvailabilityRange({
      startDate: "2026-10-10",
      endDate: "2026-10-12",
      startHour: 9,
      endHour: 11,
    });

    const futureDayEntry = result.find((d) => d.date === "2026-10-12")!;
    expect(futureDayEntry.facilities[0].status).toBe("UNAVAILABLE");
    expect(futureDayEntry.facilities[0].reason).toBe("ALREADY_BOOKED");
    expect(futureDayEntry.facilities[0].rental).toBeNull();
  });

  it("never attaches rental info to edutrip packages", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T10:00:00.000Z"));
    prismaMock.edutripPackage.findMany.mockResolvedValue([edutrip("e1", "Susur Sungai")]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result[0].rental).toBeNull();
  });
});
