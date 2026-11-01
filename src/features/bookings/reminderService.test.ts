import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getHomestayRentalWindow,
  getVenueRentalWindow,
} from "@/lib/bookingWindow";
import {
  BOOKING_CHECKIN_OVERDUE,
  BOOKING_ENDING_SOON,
} from "@/lib/bookingNotificationPolicy";

const prismaMock = {
  transactionHomestay: { findMany: vi.fn() },
  transactionVenue: { findMany: vi.fn() },
  bookingNotificationEvent: { create: vi.fn(), deleteMany: vi.fn() },
};
const getActiveFieldOfficerIdsMock = vi.fn();
const broadcastToUsersMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/features/notifications/pushService", () => ({
  getActiveFieldOfficerIds: getActiveFieldOfficerIdsMock,
  broadcastToUsers: broadcastToUsersMock,
}));

const { getBookingReminderEvents, sendBookingReminders } = await import(
  "./reminderService"
);

const checkInDate = new Date("2026-11-01T00:00:00.000Z");
const checkOutDate = new Date("2026-11-02T00:00:00.000Z");
const homestayWindow = getHomestayRentalWindow(checkInDate, checkOutDate);

const homestayBooking = {
  id: "homestay-booking-1",
  bookingStatus: "CHECKED_IN",
  checkInDate,
  checkOutDate,
  homestay: { name: "Homestay Melati" },
  transaction: { invoiceNumber: "INV-H-1", customerName: "Budi" },
};

const venueBooking = {
  id: "venue-booking-1",
  bookingStatus: "CONFIRMED",
  bookingDate: new Date("2026-11-01T00:00:00.000Z"),
  startTime: new Date("1970-01-01T09:00:00.000Z"),
  endTime: new Date("1970-01-01T11:00:00.000Z"),
  venue: { name: "Aula Utama" },
  transaction: { invoiceNumber: "INV-V-1", customerName: "Sari" },
};
const venueWindow = getVenueRentalWindow(
  venueBooking.bookingDate,
  venueBooking.startTime,
  venueBooking.endTime,
);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.transactionHomestay.findMany.mockResolvedValue([]);
  prismaMock.transactionVenue.findMany.mockResolvedValue([]);
  prismaMock.bookingNotificationEvent.create.mockResolvedValue({});
  prismaMock.bookingNotificationEvent.deleteMany.mockResolvedValue({ count: 0 });
  getActiveFieldOfficerIdsMock.mockResolvedValue(["officer-1"]);
  broadcastToUsersMock.mockResolvedValue({ status: "sent", sentCount: 1 });
});

describe("getBookingReminderEvents", () => {
  it("creates an ending-soon event for a checked-in homestay inside the 15 minute window", async () => {
    prismaMock.transactionHomestay.findMany.mockResolvedValue([homestayBooking]);

    const events = await getBookingReminderEvents(
      new Date(homestayWindow.validUntil.getTime() - 10 * 60_000),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: BOOKING_ENDING_SOON,
      bookingType: "homestay",
      bookingId: "homestay-booking-1",
      facilityName: "Homestay Melati",
    });
  });

  it("creates a no-show event for a venue after its 15 minute check-in grace", async () => {
    prismaMock.transactionVenue.findMany.mockResolvedValue([venueBooking]);

    const events = await getBookingReminderEvents(
      new Date(venueWindow.validFrom.getTime() + 16 * 60_000),
    );

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      eventType: BOOKING_CHECKIN_OVERDUE,
      bookingType: "venue",
      bookingId: "venue-booking-1",
      facilityName: "Aula Utama",
    });
  });

  it("does not create a no-show event before the homestay 2 hour grace", async () => {
    prismaMock.transactionHomestay.findMany.mockResolvedValue([
      { ...homestayBooking, bookingStatus: "CONFIRMED" },
    ]);

    const events = await getBookingReminderEvents(
      new Date(homestayWindow.validFrom.getTime() + 119 * 60_000),
    );

    expect(events).toEqual([]);
  });

  it("does not create an ending-soon event for a booking that never checked in", async () => {
    prismaMock.transactionHomestay.findMany.mockResolvedValue([
      { ...homestayBooking, bookingStatus: "CONFIRMED" },
    ]);

    const events = await getBookingReminderEvents(
      new Date(homestayWindow.validUntil.getTime() - 10 * 60_000),
    );

    expect(events).toHaveLength(1);
    expect(events[0].eventType).toBe(BOOKING_CHECKIN_OVERDUE);
  });
});

describe("sendBookingReminders", () => {
  it("broadcasts one event and stores the booking reference", async () => {
    prismaMock.transactionHomestay.findMany.mockResolvedValue([homestayBooking]);

    const summary = await sendBookingReminders(
      new Date(homestayWindow.validUntil.getTime() - 10 * 60_000),
    );

    expect(summary).toEqual({
      candidates: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
    });
    expect(prismaMock.bookingNotificationEvent.create).toHaveBeenCalledWith({
      data: {
        bookingType: "homestay",
        bookingId: "homestay-booking-1",
        eventType: BOOKING_ENDING_SOON,
      },
    });
    expect(broadcastToUsersMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ["officer-1"],
        booking: expect.objectContaining({
          bookingType: "homestay",
          bookingId: "homestay-booking-1",
          invoiceNumber: "INV-H-1",
        }),
        data: expect.objectContaining({
          type: BOOKING_ENDING_SOON,
          bookingId: "homestay-booking-1",
        }),
      }),
    );
  });

  it("skips an event already claimed by a previous/overlapping run", async () => {
    prismaMock.transactionHomestay.findMany.mockResolvedValue([homestayBooking]);
    prismaMock.bookingNotificationEvent.create.mockRejectedValue({
      code: "P2002",
    });

    const summary = await sendBookingReminders(
      new Date(homestayWindow.validUntil.getTime() - 10 * 60_000),
    );

    expect(summary).toEqual({
      candidates: 1,
      sent: 0,
      skipped: 1,
      failed: 0,
    });
    expect(broadcastToUsersMock).not.toHaveBeenCalled();
  });

  it("does not claim an event when there are no active recipients", async () => {
    prismaMock.transactionHomestay.findMany.mockResolvedValue([homestayBooking]);
    getActiveFieldOfficerIdsMock.mockResolvedValue([]);

    const summary = await sendBookingReminders(
      new Date(homestayWindow.validUntil.getTime() - 10 * 60_000),
    );

    expect(summary).toEqual({
      candidates: 1,
      sent: 0,
      skipped: 1,
      failed: 0,
    });
    expect(prismaMock.bookingNotificationEvent.create).not.toHaveBeenCalled();
  });
});
