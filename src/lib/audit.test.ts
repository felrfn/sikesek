import { describe, expect, it, vi, beforeEach } from "vitest";

const createMock = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: { auditLog: { create: createMock } } }));

const { logAudit } = await import("./audit");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("logAudit", () => {
  it("writes the expected row for a human actor", async () => {
    createMock.mockResolvedValue({});

    await logAudit({
      actor: { id: "admin-1", name: "Admin User" },
      action: "facility.activated",
      entityType: "Facility",
      entityId: "facility-1",
    });

    expect(createMock).toHaveBeenCalledWith({
      data: {
        actorId: "admin-1",
        actorName: "Admin User",
        action: "facility.activated",
        entityType: "Facility",
        entityId: "facility-1",
        metadata: undefined,
      },
    });
  });

  it("records a null actor as a system action rather than throwing or inventing a fake user", async () => {
    createMock.mockResolvedValue({});

    await logAudit({
      actor: null,
      action: "ktr.auto_resolved",
      entityType: "SmokingDetection",
      entityId: "detection-1",
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorId: null, actorName: "System" }) }),
    );
  });

  /**
   * Regression test for the toggle-active 500 bug: logAudit is always
   * called *after* the real mutation already committed, so a failure here
   * (e.g. a foreign key violation because the actor id is stale) must never
   * propagate and make the caller think the whole operation failed.
   */
  it("swallows a failure (e.g. a foreign key violation on a stale actor id) instead of throwing", async () => {
    const fkError = Object.assign(new Error("Foreign key constraint violated: audit_logs_actor_id_fkey"), {
      code: "P2003",
    });
    createMock.mockRejectedValue(fkError);
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      logAudit({
        actor: { id: "stale-admin-id", name: "Admin User" },
        action: "facility.activated",
        entityType: "Facility",
        entityId: "facility-1",
      }),
    ).resolves.toBeUndefined();

    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });
});
