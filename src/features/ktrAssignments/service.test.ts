import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaMock = {
  smokingDetection: { findUnique: vi.fn(), update: vi.fn() },
  ktrAssignment: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  user: { findMany: vi.fn() },
  $transaction: vi.fn(),
};
const notifyUsersMock = vi.fn();
const broadcastToUsersMock = vi.fn();
const getActiveFieldOfficerIdsMock = vi.fn();
const logAuditMock = vi.fn();
const claimDetectionMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));
vi.mock("@/lib/siteConfig", () => ({
  getTodayInJakarta: () => "2026-10-31",
}));
vi.mock("@/features/notifications/pushService", () => ({
  notifyUsers: notifyUsersMock,
  broadcastToUsers: broadcastToUsersMock,
  getActiveFieldOfficerIds: getActiveFieldOfficerIdsMock,
}));
vi.mock("@/features/violations/service", () => ({
  claimDetection: claimDetectionMock,
  DetectionWorkflowError: class DetectionWorkflowError extends Error {},
}));

const { AssignmentError, createAssignments } = await import("./service");

const detection = {
  id: "detection-1",
  status: "NOTIFIED",
  detectedAt: new Date("2026-10-31T07:32:00.000Z"),
  area: { id: "area-1", name: "Gazebo 01" },
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.smokingDetection.findUnique.mockResolvedValue(detection);
  prismaMock.smokingDetection.update.mockResolvedValue({});
  prismaMock.ktrAssignment.findMany.mockResolvedValue([]);
  prismaMock.user.findMany.mockResolvedValue([
    { id: "officer-1", name: "Jane", email: "jane@example.com", schedules: [] },
    { id: "officer-2", name: "Budi", email: "budi@example.com", schedules: [] },
    { id: "officer-3", name: "Sari", email: "sari@example.com", schedules: [] },
  ]);
  prismaMock.ktrAssignment.create.mockImplementation(
    ({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: `assignment-${data.assignedToId as string}`,
        ...data,
      }),
  );
  prismaMock.$transaction.mockImplementation((operations: Promise<unknown>[]) =>
    Promise.all(operations),
  );
  notifyUsersMock.mockResolvedValue([]);
  broadcastToUsersMock.mockResolvedValue({ status: "sent", sentCount: 1 });
  getActiveFieldOfficerIdsMock.mockResolvedValue([
    "officer-1",
    "officer-2",
    "officer-3",
  ]);
});

describe("createAssignments notifications", () => {
  it("sends actionable KTR_ASSIGNMENT to assignees and one informational broadcast to everyone else", async () => {
    await createAssignments({
      detectionId: detection.id,
      workerIds: ["officer-1", "officer-2"],
      assignedBy: { id: "admin-1", name: "Admin" },
    });

    expect(notifyUsersMock).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: "officer-1",
        detectionId: detection.id,
        title: "New KTR Task",
        data: {
          type: "KTR_ASSIGNMENT",
          assignmentId: "assignment-officer-1",
          violationId: detection.id,
          assignedBy: "Admin",
        },
      }),
      expect.objectContaining({
        userId: "officer-2",
        detectionId: detection.id,
        title: "New KTR Task",
        data: {
          type: "KTR_ASSIGNMENT",
          assignmentId: "assignment-officer-2",
          violationId: detection.id,
          assignedBy: "Admin",
        },
      }),
    ]);

    expect(broadcastToUsersMock).toHaveBeenCalledWith({
      userIds: ["officer-3"],
      detectionId: detection.id,
      title: "KTR case assigned",
      body: expect.stringContaining("Jane, Budi"),
      data: {
        type: "KTR_VIOLATION_ASSIGNED",
        violationId: detection.id,
        assignedTo: "Jane, Budi",
        assignedBy: "Admin",
      },
    });
  });

  it("does not send the informational broadcast when every officer is an assignee", async () => {
    await createAssignments({
      detectionId: detection.id,
      workerIds: ["officer-1", "officer-2", "officer-3"],
      assignedBy: { id: "admin-1", name: "Admin" },
    });

    expect(broadcastToUsersMock).not.toHaveBeenCalled();
  });

  it("rejects a duplicate live assignment without creating rows", async () => {
    prismaMock.ktrAssignment.findMany.mockResolvedValue([
      { assignedToId: "officer-1" },
    ]);

    const error = await createAssignments({
      detectionId: detection.id,
      workerIds: ["officer-1"],
      assignedBy: { id: "admin-1", name: "Admin" },
    }).catch((caught) => caught);

    expect(error).toBeInstanceOf(AssignmentError);
    expect(error.code).toBe("CONFLICT");
    expect(prismaMock.ktrAssignment.create).not.toHaveBeenCalled();
    expect(notifyUsersMock).not.toHaveBeenCalled();
  });
});
