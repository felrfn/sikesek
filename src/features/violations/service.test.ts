import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  monitoredArea: { findUnique: vi.fn() },
  smokingDetection: {
    create: vi.fn(),
    update: vi.fn(),
    findUnique: vi.fn(),
    updateMany: vi.fn(),
  },
  user: { findUnique: vi.fn() },
  ktrAssignment: { updateMany: vi.fn() },
};
const broadcastToUsersMock = vi.fn();
const getActiveFieldOfficerIdsMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/features/notifications/pushService", () => ({
  broadcastToUsers: broadcastToUsersMock,
  getActiveFieldOfficerIds: getActiveFieldOfficerIdsMock,
}));

const {
  DetectionIngestError,
  DetectionWorkflowError,
  claimDetection,
  ingestDetection,
  resolveDetectionForUser,
} = await import("./service");

const input = {
  areaId: "aa6f9aee-73e0-4c53-a180-9bd9956b90d0",
  confidence: 0.94,
  evidenceKey:
    "private/ktr/evidence/aa6f9aee-73e0-4c53-a180-9bd9956b90d0/frame.jpg",
  detectedAt: "2026-10-31T07:32:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  broadcastToUsersMock.mockResolvedValue({ status: "sent", sentCount: 2 });
  getActiveFieldOfficerIdsMock.mockResolvedValue(["officer-1", "officer-2"]);
  prismaMock.smokingDetection.update.mockResolvedValue({});
  prismaMock.smokingDetection.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.ktrAssignment.updateMany.mockResolvedValue({ count: 0 });
  prismaMock.user.findUnique.mockResolvedValue({
    id: "officer-1",
    name: "Jane",
  });
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

  it("records the detection, broadcasts KTR_VIOLATION_NEW, and marks it NOTIFIED", async () => {
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

    expect(getActiveFieldOfficerIdsMock).toHaveBeenCalled();
    expect(broadcastToUsersMock).toHaveBeenCalledWith({
      userIds: ["officer-1", "officer-2"],
      detectionId: detection.id,
      title: "Pelanggaran KTR terdeteksi",
      body: expect.stringContaining("Gazebo 01"),
      data: {
        type: "KTR_VIOLATION_NEW",
        violationId: detection.id,
        areaId: input.areaId,
        confidence: "0.94",
        detectedAt: detectedAt.toISOString(),
      },
    });

    const body = broadcastToUsersMock.mock.calls[0][0].body as string;
    expect(body).toContain("Gazebo 01");
    expect(body).toContain("94%");

    expect(prismaMock.smokingDetection.update).toHaveBeenCalledWith({
      where: { id: detection.id },
      data: { status: "NOTIFIED" },
    });
  });
});

describe("claimDetection", () => {
  const openDetection = {
    id: "detection-1",
    status: "NOTIFIED",
    handlingById: null,
    handlingStartedAt: null,
    handlingByUser: null,
    area: { id: input.areaId, name: "Gazebo 01" },
  };

  it("claims an open case, moves the assignment, and broadcasts to other officers", async () => {
    const claimedAt = new Date("2026-10-31T08:00:00.000Z");
    const claimedDetection = {
      ...openDetection,
      status: "IN_PROGRESS",
      handlingById: "officer-1",
      handlingStartedAt: claimedAt,
      handlingByUser: { id: "officer-1", name: "Jane" },
    };

    prismaMock.smokingDetection.findUnique
      .mockResolvedValueOnce(openDetection)
      .mockResolvedValueOnce(claimedDetection);

    const result = await claimDetection("detection-1", "officer-1");

    expect(result.alreadyClaimed).toBe(false);
    expect(prismaMock.smokingDetection.updateMany).toHaveBeenCalledWith({
      where: {
        id: "detection-1",
        status: { in: ["DETECTED", "NOTIFIED", "ASSIGNED", "IN_PROGRESS"] },
        OR: [{ handlingById: null }, { handlingById: "officer-1" }],
      },
      data: {
        handlingById: "officer-1",
        handlingStartedAt: expect.any(Date),
        status: "IN_PROGRESS",
      },
    });
    expect(prismaMock.ktrAssignment.updateMany).toHaveBeenCalledWith({
      where: {
        detectionId: "detection-1",
        assignedToId: "officer-1",
        status: "ASSIGNED",
      },
      data: { status: "IN_PROGRESS", acceptedAt: expect.any(Date) },
    });
    expect(broadcastToUsersMock).toHaveBeenCalledWith({
      userIds: ["officer-2"],
      detectionId: "detection-1",
      title: "Kasus KTR sedang ditangani",
      body: expect.stringContaining("Jane"),
      data: {
        type: "KTR_VIOLATION_CLAIMED",
        violationId: "detection-1",
        handledBy: "Jane",
        handledAt: expect.any(String),
      },
    });
  });

  it("is idempotent when the same officer already claimed it", async () => {
    prismaMock.smokingDetection.findUnique.mockResolvedValue({
      ...openDetection,
      status: "IN_PROGRESS",
      handlingById: "officer-1",
      handlingByUser: { id: "officer-1", name: "Jane" },
    });

    const result = await claimDetection("detection-1", "officer-1");

    expect(result.alreadyClaimed).toBe(true);
    expect(prismaMock.smokingDetection.updateMany).not.toHaveBeenCalled();
    expect(broadcastToUsersMock).not.toHaveBeenCalled();
  });

  it("rejects a case another officer is already handling", async () => {
    prismaMock.smokingDetection.findUnique.mockResolvedValue({
      ...openDetection,
      status: "IN_PROGRESS",
      handlingById: "officer-2",
      handlingByUser: { id: "officer-2", name: "Budi" },
    });
    prismaMock.user.findUnique.mockResolvedValue({
      id: "officer-2",
      name: "Budi",
    });

    const error = await claimDetection("detection-1", "officer-1").catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(DetectionWorkflowError);
    expect(error.code).toBe("ALREADY_CLAIMED");
    expect(error.details).toEqual({ handledBy: "Budi" });
    expect(prismaMock.smokingDetection.updateMany).not.toHaveBeenCalled();
  });

  it("rejects a closed case", async () => {
    prismaMock.smokingDetection.findUnique.mockResolvedValue({
      ...openDetection,
      status: "RESOLVED",
    });

    const error = await claimDetection("detection-1", "officer-1").catch(
      (caught) => caught,
    );

    expect(error).toBeInstanceOf(DetectionWorkflowError);
    expect(error.code).toBe("CASE_CLOSED");
    expect(broadcastToUsersMock).not.toHaveBeenCalled();
  });
});

describe("resolveDetectionForUser", () => {
  const openDetection = {
    id: "detection-1",
    status: "ASSIGNED",
    resolvedBy: null,
    resolvedAt: null,
    resolvedByUser: null,
    area: { id: input.areaId, name: "Gazebo 01" },
  };

  it("resolves once, closes assignments, and broadcasts to every officer", async () => {
    const resolvedAt = new Date("2026-10-31T09:00:00.000Z");
    const resolvedDetection = {
      ...openDetection,
      status: "RESOLVED",
      resolvedBy: "officer-1",
      resolvedAt,
      resolvedByUser: { id: "officer-1", name: "Jane" },
    };

    prismaMock.smokingDetection.findUnique
      .mockResolvedValueOnce(openDetection)
      .mockResolvedValueOnce(resolvedDetection);

    const result = await resolveDetectionForUser({
      detectionId: "detection-1",
      resolver: { id: "officer-1", name: "Jane" },
      notes: "Handled on site",
    });

    expect(result.alreadyResolved).toBe(false);
    expect(prismaMock.smokingDetection.updateMany).toHaveBeenCalledWith({
      where: {
        id: "detection-1",
        status: { in: ["DETECTED", "NOTIFIED", "ASSIGNED", "IN_PROGRESS"] },
      },
      data: {
        status: "RESOLVED",
        resolvedBy: "officer-1",
        resolvedAt: expect.any(Date),
        notes: "Handled on site",
      },
    });

    expect(prismaMock.ktrAssignment.updateMany).toHaveBeenNthCalledWith(1, {
      where: {
        detectionId: "detection-1",
        assignedToId: "officer-1",
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      data: { status: "COMPLETED", completedAt: expect.any(Date) },
    });
    expect(prismaMock.ktrAssignment.updateMany).toHaveBeenNthCalledWith(2, {
      where: {
        detectionId: "detection-1",
        assignedToId: { not: "officer-1" },
        status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      },
      data: { status: "CANCELLED" },
    });

    expect(broadcastToUsersMock).toHaveBeenCalledWith({
      userIds: ["officer-1", "officer-2"],
      detectionId: "detection-1",
      title: "Pelanggaran KTR selesai",
      body: expect.stringContaining("Jane"),
      data: {
        type: "KTR_VIOLATION_RESOLVED",
        violationId: "detection-1",
        resolvedBy: "Jane",
        resolvedAt: expect.any(String),
      },
    });
  });

  it("does not broadcast again for an already-resolved case", async () => {
    prismaMock.smokingDetection.findUnique.mockResolvedValue({
      ...openDetection,
      status: "RESOLVED",
      resolvedByUser: { id: "officer-2", name: "Budi" },
    });

    const result = await resolveDetectionForUser({
      detectionId: "detection-1",
      resolver: { id: "officer-1", name: "Jane" },
    });

    expect(result.alreadyResolved).toBe(true);
    expect(prismaMock.smokingDetection.updateMany).not.toHaveBeenCalled();
    expect(broadcastToUsersMock).not.toHaveBeenCalled();
  });

  it("rejects a false-positive/dismissed case", async () => {
    prismaMock.smokingDetection.findUnique.mockResolvedValue({
      ...openDetection,
      status: "FALSE_POSITIVE",
    });

    const error = await resolveDetectionForUser({
      detectionId: "detection-1",
      resolver: { id: "officer-1", name: "Jane" },
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(DetectionWorkflowError);
    expect(error.code).toBe("CASE_CLOSED");
    expect(broadcastToUsersMock).not.toHaveBeenCalled();
  });
});
