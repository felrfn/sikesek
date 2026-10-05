import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMock = {
  holiday: { findMany: vi.fn() },
  homestay: { findMany: vi.fn() },
  venue: { findMany: vi.fn() },
  edutripPackage: { findMany: vi.fn() },
  transactionHomestay: { findMany: vi.fn() },
  transactionVenue: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { getFacilityAvailability } = await import("./service");

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

describe("getFacilityAvailability", () => {
  it("reports a facility with no conflicts as available", async () => {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      { id: "h1", category: "homestay", name: "AREN 1", status: "AVAILABLE", reason: null },
    ]);
  });

  it("reports a deactivated facility as unavailable with reason INACTIVE, even with no bookings", async () => {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1", false)]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      { id: "h1", category: "homestay", name: "AREN 1", status: "UNAVAILABLE", reason: "INACTIVE" },
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
      { id: "h1", category: "homestay", name: "AREN 1", status: "UNAVAILABLE", reason: "CLOSED_HOLIDAY" },
      { id: "v1", category: "venue", name: "Balai Pertemuan", status: "UNAVAILABLE", reason: "CLOSED_HOLIDAY" },
      { id: "e1", category: "edutrip", name: "Susur Sungai", status: "UNAVAILABLE", reason: "CLOSED_HOLIDAY" },
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
    prismaMock.transactionHomestay.findMany.mockResolvedValue([{ homestayId: "h1" }]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      { id: "h1", category: "homestay", name: "AREN 1", status: "UNAVAILABLE", reason: "ALREADY_BOOKED" },
    ]);
  });

  it("queries conflicts with the blocking booking/payment status filters, not just any transaction row", async () => {
    prismaMock.homestay.findMany.mockResolvedValue([homestay("h1", "AREN 1")]);

    await getFacilityAvailability({ date: "2026-10-10" });

    const where = prismaMock.transactionHomestay.findMany.mock.calls[0][0].where;
    expect(where.bookingStatus.in).toEqual(["PENDING", "CONFIRMED", "CHECKED_IN", "COMPLETED"]);
    expect(where.transaction.paymentStatus.in).toEqual(["PENDING", "PAID"]);
  });

  it("reports a venue as unavailable (ALREADY_BOOKED) when the requested hour range overlaps an existing booking", async () => {
    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      { venueId: "v1", startTime: hourDate(9), endTime: hourDate(11) },
    ]);

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 10,
      endHour: 12,
    });

    expect(result).toEqual([
      { id: "v1", category: "venue", name: "Balai Pertemuan", status: "UNAVAILABLE", reason: "ALREADY_BOOKED" },
    ]);
  });

  it("reports a venue as available when the requested hour range does not overlap an existing booking", async () => {
    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      { venueId: "v1", startTime: hourDate(9), endTime: hourDate(11) },
    ]);

    const result = await getFacilityAvailability({
      date: "2026-10-10",
      startHour: 11,
      endHour: 13,
    });

    expect(result).toEqual([
      { id: "v1", category: "venue", name: "Balai Pertemuan", status: "AVAILABLE", reason: null },
    ]);
  });

  it("does not apply a time-conflict check to venues when startHour/endHour are omitted", async () => {
    prismaMock.venue.findMany.mockResolvedValue([venue("v1", "Balai Pertemuan")]);
    prismaMock.transactionVenue.findMany.mockResolvedValue([
      { venueId: "v1", startTime: hourDate(0), endTime: hourDate(24) },
    ]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      { id: "v1", category: "venue", name: "Balai Pertemuan", status: "AVAILABLE", reason: null },
    ]);
  });

  it("never returns ALREADY_BOOKED for edutrip packages (pax-based, not exclusive)", async () => {
    prismaMock.edutripPackage.findMany.mockResolvedValue([edutrip("e1", "Susur Sungai")]);

    const result = await getFacilityAvailability({ date: "2026-10-10" });

    expect(result).toEqual([
      { id: "e1", category: "edutrip", name: "Susur Sungai", status: "AVAILABLE", reason: null },
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
