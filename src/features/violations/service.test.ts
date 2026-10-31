import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  monitoredArea: { findUnique: vi.fn() },
  smokingDetection: { create: vi.fn(), update: vi.fn() },
  user: { findMany: vi.fn() },
  notification: { createMany: vi.fn() },
};
const sendPushToTokensMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/fcm", () => ({ sendPushToTokens: sendPushToTokensMock }));

const { DetectionIngestError, ingestDetection } = await import("./service");

const input = {
  areaId: "aa6f9aee-73e0-4c53-a180-9bd9956b90d0",
  confidence: 0.94,
  evidenceKey:
    "private/ktr/evidence/aa6f9aee-73e0-4c53-a180-9bd9956b90d0/frame.jpg",
  detectedAt: "2026-10-31T07:32:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.notification.createMany.mockResolvedValue({ count: 0 });
  prismaMock.smokingDetection.update.mockResolvedValue({});
  sendPushToTokensMock.mockResolvedValue(undefined);
});

describe("ingestDetection", () => {
  it("rejects an unknown area with UNKNOWN_AREA and writes nothing", async () => {
    prismaMock.monitoredArea.findUnique.mockResolvedValue(null);

    const error = await ingestDetection(input).catch((caught) => caught);

    expect(error).toBeInstanceOf(DetectionIngestError);
    expect(error.code).toBe("UNKNOWN_AREA");
    expect(prismaMock.smokingDetection.create).not.toHaveBeenCalled();
  });

  it("rejects an inactive area with AREA_INACTIVE and writes nothing", async () => {
    prismaMock.monitoredArea.findUnique.mockResolvedValue({
      id: input.areaId,
      name: "Gazebo 01",
      isActive: false,
    });

    const error = await ingestDetection(input).catch((caught) => caught);

    expect(error).toBeInstanceOf(DetectionIngestError);
    expect(error.code).toBe("AREA_INACTIVE");
    expect(prismaMock.smokingDetection.create).not.toHaveBeenCalled();
  });

  it("records the detection, notifies officers, and marks it NOTIFIED", async () => {
    const detectedAt = new Date(input.detectedAt);
    const detection = {
      id: "detection-1",
      areaId: input.areaId,
      confidence: input.confidence,
      evidenceKey: input.evidenceKey,
      detectedAt,
      status: "DETECTED",
    };

    prismaMock.monitoredArea.findUnique.mockResolvedValue({
      id: input.areaId,
      name: "Gazebo 01",
      isActive: true,
    });
    prismaMock.smokingDetection.create.mockResolvedValue(detection);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "officer-1", name: "Jane", fcmTokens: [{ token: "token-1" }, { token: "token-2" }] },
      { id: "officer-2", name: "Budi", fcmTokens: [] },
    ]);

    const result = await ingestDetection(input);

    expect(result).toBe(detection);
    expect(prismaMock.smokingDetection.create).toHaveBeenCalledWith({
      data: {
        areaId: input.areaId,
        confidence: input.confidence,
        evidenceKey: input.evidenceKey,
        detectedAt,
        status: "DETECTED",
        source: "API",
      },
    });

    expect(prismaMock.notification.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          detectionId: detection.id,
          recipientId: "officer-1",
          title: "KTR violation detected",
        }),
        expect.objectContaining({
          detectionId: detection.id,
          recipientId: "officer-2",
          title: "KTR violation detected",
        }),
      ],
    });

    const notificationBody = prismaMock.notification.createMany.mock.calls[0][0]
      .data[0].body as string;
    expect(notificationBody).toContain("Gazebo 01");
    expect(notificationBody).toContain("94%");

    expect(sendPushToTokensMock).toHaveBeenCalledWith(["token-1", "token-2"], {
      title: "KTR violation detected",
      body: expect.stringContaining("Gazebo 01"),
    });

    expect(prismaMock.smokingDetection.update).toHaveBeenCalledWith({
      where: { id: detection.id },
      data: { status: "NOTIFIED" },
    });
  });
});
