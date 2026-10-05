import { describe, expect, it, vi, beforeEach } from "vitest";

const prismaMock = {
  transactionHomestay: { findUnique: vi.fn(), update: vi.fn() },
  transactionVenue: { findUnique: vi.fn(), update: vi.fn() },
  transactionEdutrip: { findUnique: vi.fn(), update: vi.fn() },
};
const logAuditMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));

const { checkoutBooking, transitionBookingStatus, InvalidBookingTransitionError } = await import(
  "./service"
);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("transitionBookingStatus", () => {
  it("rejects a transition for a booking that doesn't exist, with reason NOT_FOUND", async () => {
    prismaMock.transactionHomestay.findUnique.mockResolvedValue(null);

    const error = await transitionBookingStatus("homestay", "missing-id", "COMPLETED").catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(InvalidBookingTransitionError);
    expect(error.reason).toBe("NOT_FOUND");
  });

  it("rejects an invalid transition (not currently CHECKED_IN), with reason INVALID_TRANSITION", async () => {
    prismaMock.transactionHomestay.findUnique.mockResolvedValue({ bookingStatus: "PENDING" });

    const error = await transitionBookingStatus("homestay", "booking-1", "COMPLETED").catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(InvalidBookingTransitionError);
    expect(error.reason).toBe("INVALID_TRANSITION");
    expect(prismaMock.transactionHomestay.update).not.toHaveBeenCalled();
  });

  it("rejects checking out a booking that was already checked out (prevents duplicate checkout)", async () => {
    prismaMock.transactionHomestay.findUnique.mockResolvedValue({ bookingStatus: "COMPLETED" });

    const error = await transitionBookingStatus("homestay", "booking-1", "COMPLETED").catch(
      (e) => e,
    );

    expect(error).toBeInstanceOf(InvalidBookingTransitionError);
    expect(error.reason).toBe("INVALID_TRANSITION");
  });

  it("allows CHECKED_IN -> COMPLETED", async () => {
    prismaMock.transactionHomestay.findUnique.mockResolvedValue({ bookingStatus: "CHECKED_IN" });
    prismaMock.transactionHomestay.update.mockResolvedValue({ id: "booking-1", bookingStatus: "COMPLETED" });

    await transitionBookingStatus("homestay", "booking-1", "COMPLETED");

    expect(prismaMock.transactionHomestay.update).toHaveBeenCalledWith({
      where: { id: "booking-1" },
      data: { bookingStatus: "COMPLETED" },
    });
  });
});

describe("checkoutBooking", () => {
  const actor = { id: "officer-1", name: "Jane Doe" };

  it("transitions the booking, logs the officer as the audit actor, and returns the facility name", async () => {
    prismaMock.transactionHomestay.findUnique
      .mockResolvedValueOnce({ bookingStatus: "CHECKED_IN" }) // transitionBookingStatus's current-status read
      .mockResolvedValueOnce({
        // getBookingDetail's full read
        id: "booking-1",
        homestay: { name: "AREN 1" },
        transaction: {},
        ticket: null,
      });
    prismaMock.transactionHomestay.update.mockResolvedValue({ id: "booking-1", bookingStatus: "COMPLETED" });

    const result = await checkoutBooking("homestay", "booking-1", actor);

    expect(result).toEqual({
      bookingId: "booking-1",
      bookingType: "homestay",
      status: "COMPLETED",
      facilityName: "AREN 1",
    });
    expect(logAuditMock).toHaveBeenCalledWith({
      actor,
      action: "homestay.checked_out",
      entityType: "TransactionHomestay",
      entityId: "booking-1",
      metadata: { facilityName: "AREN 1" },
    });
  });

  it("does not check out (and never calls logAudit) a booking that isn't currently CHECKED_IN", async () => {
    prismaMock.transactionVenue.findUnique.mockResolvedValue({ bookingStatus: "PENDING" });

    await expect(checkoutBooking("venue", "booking-2", actor)).rejects.toBeInstanceOf(
      InvalidBookingTransitionError,
    );
    expect(logAuditMock).not.toHaveBeenCalled();
    expect(prismaMock.transactionVenue.update).not.toHaveBeenCalled();
  });
});
