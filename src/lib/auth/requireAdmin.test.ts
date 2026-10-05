import { describe, expect, it, vi, beforeEach } from "vitest";

const authMock = vi.fn();
const findUniqueMock = vi.fn();

vi.mock("@/lib/auth/auth", () => ({ auth: authMock }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique: findUniqueMock } } }));

const { requireAdmin } = await import("./requireAdmin");

function dbUser(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "user-1",
    name: "Admin User",
    email: "admin@sikesek.gov",
    role: "ADMIN",
    deletedAt: null,
    approvedAt: new Date("2026-01-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAdmin", () => {
  it("rejects when there is no session", async () => {
    authMock.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
    expect(findUniqueMock).not.toHaveBeenCalled();
  });

  it("rejects when the session role isn't ADMIN", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "FIELD_OFFICER" } });
    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  /**
   * The actual bug this regression-tests: a JWT session carrying an id that
   * no longer exists in `users` (e.g. the row was deleted, or the dev
   * database was reset/reseeded without the browser's session cookie being
   * cleared). Previously requireAdmin() trusted the JWT's id/role as-is and
   * returned it, so this stale id would later violate the audit_logs
   * foreign key the moment any mutation tried to log an action with it -
   * the mutation itself would succeed, but the whole request would still
   * 500. It must now be rejected here instead, before any mutation runs.
   */
  it("rejects when the session's user id no longer exists in the database", async () => {
    authMock.mockResolvedValue({ user: { id: "stale-id", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
    expect(findUniqueMock).toHaveBeenCalledWith({ where: { id: "stale-id" } });
  });

  it("rejects when the database user was soft-deleted since the session was issued", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(dbUser({ deletedAt: new Date() }));

    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  it("rejects when the database user was demoted from ADMIN since the session was issued", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(dbUser({ role: "FIELD_OFFICER" }));

    await expect(requireAdmin()).rejects.toThrow("Unauthorized");
  });

  it("returns the fresh database user when the session is valid and still an active admin", async () => {
    authMock.mockResolvedValue({ user: { id: "user-1", role: "ADMIN" } });
    findUniqueMock.mockResolvedValue(dbUser());

    const admin = await requireAdmin();

    expect(admin.id).toBe("user-1");
    expect(admin.role).toBe("ADMIN");
  });
});
