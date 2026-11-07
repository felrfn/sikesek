import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const prismaMock = {
  holiday: { findMany: vi.fn() },
  homestay: { findMany: vi.fn() },
  venue: { findMany: vi.fn() },
  edutripPackage: { findMany: vi.fn() },
  transactionHomestay: { findMany: vi.fn() },
  transactionVenue: { findMany: vi.fn() },
  transactionEdutrip: { findMany: vi.fn() },
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
  prismaMock.transactionEdutrip.findMany.mockResolvedValue([]);
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
    expect(where.transaction.OR).toEqual([
      { paymentStatus: "PAID" },
      { paymentStatus: "PENDING", paymentExpiresAt: { gt: expect.any(Date) } },
    ]);
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

  it("returns an available exclusive edutrip slot when there is no booking", async () => {
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
    expect(prismaMock.transactionEdutrip.findMany).toHaveBeenCalled();
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

describe("getFacilityAvailability edutrip exclusive daily slot", () => {
  it("treats an edutrip package as an exclusive daily slot when unbooked", async () => {
    prismaMock.edutripPackage.findMany.mockResolvedValue([edutrip("e1", "EDUTRIP 2")]);
    prismaMock.transactionEdutrip.findMany.mockResolvedValue([]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result[0]).toEqual({
      id: "e1",
      category: "edutrip",
      name: "EDUTRIP 2",
      status: "AVAILABLE",
      reason: null,
      rental: null,
    });
  });

  it("reports an edutrip package as ALREADY_BOOKED once a booking exists, and fills rental on check-in", async () => {
    prismaMock.edutripPackage.findMany.mockResolvedValue([edutrip("e1", "EDUTRIP 2")]);
    prismaMock.transactionEdutrip.findMany.mockResolvedValue([
      {
        id: "edutrip-booking-1",
        packageId: "e1",
        visitDate: new Date("2026-10-10T00:00:00.000Z"),
        bookingStatus: "CONFIRMED",
        transaction: { customerName: "Rafael" },
      },
    ]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result[0]).toEqual({
      id: "e1",
      category: "edutrip",
      name: "EDUTRIP 2",
      status: "UNAVAILABLE",
      reason: "ALREADY_BOOKED",
      rental: null,
    });
  });

  it("fills the rental for a checked-in edutrip booking on the same fixed day window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T02:00:00.000Z"));
    prismaMock.edutripPackage.findMany.mockResolvedValue([edutrip("e1", "EDUTRIP 2")]);
    prismaMock.transactionEdutrip.findMany.mockResolvedValue([
      {
        id: "edutrip-booking-1",
        packageId: "e1",
        visitDate: new Date("2026-10-10T00:00:00.000Z"),
        bookingStatus: "CHECKED_IN",
        transaction: { customerName: "Rafael" },
      },
    ]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result[0]).toEqual({
      id: "e1",
      category: "edutrip",
      name: "EDUTRIP 2",
      status: "UNAVAILABLE",
      reason: "ALREADY_BOOKED",
      rental: {
        isOccupied: true,
        bookingId: "edutrip-booking-1",
        customerName: "Rafael",
        startAt: "2026-10-10T01:00:00.000Z",
        endAt: "2026-10-10T10:00:00.000Z",
        remainingSeconds: 28800,
        isExpired: false,
      },
    });
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

describe("COMPLETED bookings and slot blocking", () => {
  // Homestay 2026-10-10 -> 2026-10-11 has the rental window
  // 2026-10-10T06:00Z (13:00 WIB) -> 2026-10-11T05:00Z (12:00 WIB).
  function completedHomestay(bookingStatus = "COMPLETED") {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);
    prismaMock.transactionHomestay.findMany.mockResolvedValue([
      {
        id: "booking-done",
        homestayId: "h1",
        checkInDate: new Date("2026-10-10T00:00:00.000Z"),
        checkOutDate: new Date("2026-10-11T00:00:00.000Z"),
        bookingStatus,
        transaction: { customerName: "Jane Visitor" },
      },
    ]);
  }

  // Venue 2026-10-10 09:00-11:00 WIB -> 02:00Z-04:00Z.
  function completedVenue(bookingStatus = "COMPLETED", checkedOutAt: Date | null = null) {
    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      {
        id: "booking-done",
        venueId: "v1",
        bookingDate: new Date("2026-10-10T00:00:00.000Z"),
        startTime: hourDate(9),
        endTime: hourDate(11),
        bookingStatus,
        checkedOutAt,
        transaction: { customerName: "Jane Visitor" },
      },
    ]);
  }

  it("frees a homestay once a COMPLETED booking's rental window has ended", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T06:00:00.000Z")); // past 05:00Z checkout
    completedHomestay();

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result[0].status).toBe("AVAILABLE");
    expect(result[0].reason).toBeNull();
  });

  it("keeps holding the homestay when the guest checked out early but the window is still running", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T08:00:00.000Z")); // inside the window
    completedHomestay();

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    // The night they paid for is still theirs - an early checkout must not
    // put it back on sale.
    expect(result[0].status).toBe("UNAVAILABLE");
    expect(result[0].reason).toBe("ALREADY_BOOKED");
  });

  it("frees a venue slot once a COMPLETED booking's time slot has ended (no checkedOutAt recorded)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T05:00:00.000Z")); // past 04:00Z slot end
    completedVenue(); // checkedOutAt defaults to null (legacy row)

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 9,
      endHour: 11,
    });

    expect(result[0].status).toBe("AVAILABLE");
    expect(result[0].reason).toBeNull();
  });

  it("with no checkedOutAt recorded, falls back to holding a venue slot until the scheduled end time", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T03:00:00.000Z")); // inside 02:00Z-04:00Z
    completedVenue(); // checkedOutAt defaults to null (legacy row)

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 9,
      endHour: 11,
    });

    expect(result[0].status).toBe("UNAVAILABLE");
    expect(result[0].reason).toBe("ALREADY_BOOKED");
  });

  it("releases a venue slot IMMEDIATELY on a confirmed early checkout, well before the scheduled end time", async () => {
    vi.useFakeTimers();
    // Scheduled slot is 02:00Z-04:00Z; guest checked out early at 02:30Z and
    // we're asking about availability just one minute after that checkout -
    // 90 minutes before the slot was ever scheduled to end.
    vi.setSystemTime(new Date("2026-10-10T02:31:00.000Z"));
    completedVenue("COMPLETED", new Date("2026-10-10T02:30:00.000Z"));

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 9,
      endHour: 11,
    });

    expect(result[0].status).toBe("AVAILABLE");
    expect(result[0].reason).toBeNull();
  });

  it("an overlapping booking attempt succeeds right after an early-checkout release (authoritative conflict check)", async () => {
    const { checkAvailability } = await import("./service");

    prismaMock.transactionVenue.findMany.mockResolvedValue([
      {
        id: "booking-done",
        venueId: "v1",
        bookingDate: new Date("2026-10-10T00:00:00.000Z"),
        startTime: hourDate(9),
        endTime: hourDate(11),
        bookingStatus: "COMPLETED",
        checkedOutAt: new Date("2026-10-10T02:30:00.000Z"),
      },
    ]);
    prismaMock.holiday.findMany.mockResolvedValue([]);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T02:31:00.000Z"));

    const conflicts = await checkAvailability([
      { type: "venue", id: "v1", date: "2026-10-10", startHour: 9, endHour: 11 },
    ]);

    expect(conflicts).toEqual([]);
  });

  it("never frees a slot for an overdue CHECKED_IN booking, even past its window", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-10T05:00:00.000Z")); // past 04:00Z slot end
    completedVenue("CHECKED_IN");

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 9,
      endHour: 11,
    });

    // Still physically occupied - nobody has checked them out.
    expect(result[0].status).toBe("UNAVAILABLE");
    expect(result[0].reason).toBe("ALREADY_BOOKED");
    expect(result[0].rental).toMatchObject({ isExpired: true, isOccupied: false });
  });

  it("still blocks for PENDING/CONFIRMED bookings regardless of the clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-11T06:00:00.000Z"));
    completedHomestay("CONFIRMED");

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result[0].status).toBe("UNAVAILABLE");
    expect(result[0].reason).toBe("ALREADY_BOOKED");
  });
});

describe("homestay checkout-day monitoring (CHECKED_IN spillover)", () => {
  // Stay: check-in 2026-11-02, check-out 2026-11-03.
  // Rental window: 2026-11-02T06:00Z (13:00 WIB) -> 2026-11-03T05:00Z (12:00 WIB).
  const stayRow = {
    id: "stay-1",
    homestayId: "h1",
    checkInDate: new Date("2026-11-02T00:00:00.000Z"),
    checkOutDate: new Date("2026-11-03T00:00:00.000Z"),
    bookingStatus: "CHECKED_IN",
    transaction: { customerName: "Tamu Overdue" },
  };

  function mockHomestayQueries(conflictRows: unknown[], monitoringRows: unknown[]) {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);
    prismaMock.transactionHomestay.findMany.mockImplementation(
      async ({ where }: { where?: { checkInDate?: { gte?: Date } } }) => {
        // The booking-rule query filters by exact checkInDate (gte+lte);
        // the monitoring query only caps checkInDate (lte).
        if (where?.checkInDate?.gte) return conflictRows;
        return monitoringRows;
      },
    );
  }

  it("surfaces the CHECKED_IN stay on checkout day as occupied before endAt", async () => {
    vi.useFakeTimers();
    // 09:00 WIB on checkout day - before the 12:00 WIB checkout hour.
    vi.setSystemTime(new Date("2026-11-03T02:00:00.000Z"));
    // No booking starts on the checkout day itself, so nothing blocks it.
    mockHomestayQueries([], [stayRow]);

    const result = await getFacilityAvailability({ date: "2026-11-03" });

    expect(result[0].status).toBe("AVAILABLE");
    expect(result[0].reason).toBeNull();
    expect(result[0].rental).toEqual({
      isOccupied: true,
      bookingId: "stay-1",
      customerName: "Tamu Overdue",
      startAt: "2026-11-02T06:00:00.000Z",
      endAt: "2026-11-03T05:00:00.000Z",
      remainingSeconds: 3 * 3600,
      isExpired: false,
    });
  });

  it("keeps the stay actionable after endAt with isExpired=true and isOccupied=false", async () => {
    vi.useFakeTimers();
    // 13:00 WIB on checkout day - past the 12:00 WIB checkout hour.
    vi.setSystemTime(new Date("2026-11-03T06:00:00.000Z"));
    mockHomestayQueries([], [stayRow]);

    const result = await getFacilityAvailability({ date: "2026-11-03" });

    expect(result[0].rental).toEqual({
      isOccupied: false,
      bookingId: "stay-1",
      customerName: "Tamu Overdue",
      startAt: "2026-11-02T06:00:00.000Z",
      endAt: "2026-11-03T05:00:00.000Z",
      remainingSeconds: null,
      isExpired: true,
    });
    // Monitoring-only: still no new-date block is created by this.
    expect(result[0].status).toBe("AVAILABLE");
  });

  it("keeps reporting a stay that is overdue by several days until checkout", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-05T02:00:00.000Z")); // "today" is 2026-11-05
    mockHomestayQueries([], [stayRow]);

    const result = await getFacilityAvailability({ date: "2026-11-05" });

    expect(result[0].rental).toMatchObject({
      bookingId: "stay-1",
      isOccupied: false,
      isExpired: true,
      remainingSeconds: null,
    });
  });

  it("reports rental=null once the stay is COMPLETED", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T06:00:00.000Z"));
    // A completed stay is excluded DB-side (status filter), so both
    // queries come back empty.
    mockHomestayQueries([], []);

    const result = await getFacilityAvailability({ date: "2026-11-03" });

    expect(result[0].rental).toBeNull();
    expect(result[0].status).toBe("AVAILABLE");
  });

  it("does not let the monitoring spillover block a new booking on the checkout day", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-03T02:00:00.000Z"));
    const { checkAvailability } = await import("./service");
    // Authoritative booking check: only an exact checkInDate match blocks.
    prismaMock.transactionHomestay.findMany.mockResolvedValue([]);
    prismaMock.holiday.findMany.mockResolvedValue([]);

    const conflicts = await checkAvailability([
      { type: "homestay", id: "h1", date: "2026-11-03" },
    ]);

    expect(conflicts).toEqual([]);
  });
});
