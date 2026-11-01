import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  notification: { create: vi.fn(), createMany: vi.fn() },
  userFcmToken: { findMany: vi.fn(), updateMany: vi.fn() },
  user: { findMany: vi.fn() },
};
const sendPushToTokensMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/fcm", () => ({ sendPushToTokens: sendPushToTokensMock }));

const { broadcastToUsers, getActiveFieldOfficerIds, notifyUser } = await import(
  "./pushService"
);

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notification.create.mockResolvedValue({});
  prismaMock.notification.createMany.mockResolvedValue({ count: 2 });
  prismaMock.userFcmToken.findMany.mockResolvedValue([
    { token: "token-1" },
    { token: "token-2" },
  ]);
  prismaMock.userFcmToken.updateMany.mockResolvedValue({ count: 1 });
  sendPushToTokensMock.mockResolvedValue({
    sent: 2,
    skipped: false,
    invalidTokens: [],
  });
});

describe("broadcastToUsers", () => {
  it("writes one durable row per recipient and sends one multicast with data", async () => {
    const result = await broadcastToUsers({
      userIds: ["officer-1", "officer-1", "officer-2"],
      detectionId: "detection-1",
      title: "KTR violation detected",
      body: "Location: Gazebo 01",
      data: { type: "KTR_VIOLATION_NEW", violationId: "detection-1" },
    });

    expect(result).toEqual({ status: "sent", sentCount: 2 });
    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          detectionId: "detection-1",
          recipientId: "officer-1",
          title: "KTR violation detected",
          body: "Location: Gazebo 01",
          type: "KTR_VIOLATION_NEW",
          bookingType: null,
          bookingId: null,
          invoiceNumber: null,
        },
        {
          detectionId: "detection-1",
          recipientId: "officer-2",
          title: "KTR violation detected",
          body: "Location: Gazebo 01",
          type: "KTR_VIOLATION_NEW",
          bookingType: null,
          bookingId: null,
          invoiceNumber: null,
        },
      ],
    });
    expect(prismaMock.userFcmToken.findMany).toHaveBeenCalledWith({
      where: {
        userId: { in: ["officer-1", "officer-2"] },
        isActive: true,
      },
      select: { token: true },
    });
    expect(sendPushToTokensMock).toHaveBeenCalledWith(
      ["token-1", "token-2"],
      { title: "KTR violation detected", body: "Location: Gazebo 01" },
      { type: "KTR_VIOLATION_NEW", violationId: "detection-1" },
    );
  });

  it("stores booking references without a detection id", async () => {
    await broadcastToUsers({
      userIds: ["officer-1"],
      booking: {
        bookingType: "venue",
        bookingId: "booking-1",
        invoiceNumber: "INV-1",
        metadata: { facilityName: "Aula", validUntil: "2026-11-01T10:00:00.000Z" },
      },
      title: "Sewa hampir berakhir",
      body: "15 menit lagi",
      data: { type: "BOOKING_ENDING_SOON", bookingId: "booking-1" },
    });

    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        {
          recipientId: "officer-1",
          title: "Sewa hampir berakhir",
          body: "15 menit lagi",
          type: "BOOKING_ENDING_SOON",
          detectionId: null,
          bookingType: "venue",
          bookingId: "booking-1",
          invoiceNumber: "INV-1",
          metadata: {
            facilityName: "Aula",
            validUntil: "2026-11-01T10:00:00.000Z",
          },
        },
      ],
    });
  });

  it("deactivates tokens Firebase reports as permanently invalid", async () => {
    sendPushToTokensMock.mockResolvedValue({
      sent: 1,
      skipped: false,
      invalidTokens: ["token-2"],
    });

    await broadcastToUsers({
      userIds: ["officer-1"],
      detectionId: "detection-1",
      title: "Title",
      body: "Body",
    });

    expect(prismaMock.userFcmToken.updateMany).toHaveBeenCalledWith({
      where: { token: { in: ["token-2"] } },
      data: { isActive: false },
    });
  });

  it("returns failed instead of throwing when FCM errors", async () => {
    sendPushToTokensMock.mockRejectedValue(new Error("Firebase unavailable"));

    const result = await broadcastToUsers({
      userIds: ["officer-1"],
      detectionId: "detection-1",
      title: "Title",
      body: "Body",
    });

    expect(result).toEqual({ status: "failed", sentCount: 0 });
  });

  it("does nothing at all when there are no recipients", async () => {
    const result = await broadcastToUsers({
      userIds: [],
      detectionId: "detection-1",
      title: "Title",
      body: "Body",
    });

    expect(result).toEqual({ status: "skipped", sentCount: 0 });
    expect(prismaMock.notification.createMany).not.toHaveBeenCalled();
    expect(sendPushToTokensMock).not.toHaveBeenCalled();
  });
});

describe("notifyUser", () => {
  it("passes the structured data payload through to FCM", async () => {
    await notifyUser({
      userId: "officer-1",
      detectionId: "detection-1",
      title: "New KTR Task",
      body: "Assigned to you",
      data: {
        type: "KTR_ASSIGNMENT",
        assignmentId: "assignment-1",
        violationId: "detection-1",
      },
    });

    expect(sendPushToTokensMock).toHaveBeenCalledWith(
      ["token-1", "token-2"],
      { title: "New KTR Task", body: "Assigned to you" },
      {
        type: "KTR_ASSIGNMENT",
        assignmentId: "assignment-1",
        violationId: "detection-1",
      },
    );
  });
});

describe("getActiveFieldOfficerIds", () => {
  it("only returns approved, non-deleted field officers", async () => {
    prismaMock.user.findMany.mockResolvedValue([
      { id: "officer-1" },
      { id: "officer-2" },
    ]);

    const ids = await getActiveFieldOfficerIds();

    expect(ids).toEqual(["officer-1", "officer-2"]);
    expect(prismaMock.user.findMany).toHaveBeenCalledWith({
      where: {
        role: "FIELD_OFFICER",
        deletedAt: null,
        approvedAt: { not: null },
      },
      select: { id: true },
    });
  });
});
