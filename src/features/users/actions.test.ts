import { beforeEach, describe, expect, it, vi } from "vitest";
import bcrypt from "bcryptjs";

const requireAdminMock = vi.fn();
const updateMock = vi.fn();
const findFirstMock = vi.fn();
const logAuditMock = vi.fn();

vi.mock("@/lib/auth/requireAdmin", () => ({ requireAdmin: requireAdminMock }));
vi.mock("@/lib/prisma", () => ({
  prisma: { user: { update: updateMock, findFirst: findFirstMock } },
}));
vi.mock("@/lib/audit", () => ({ logAudit: logAuditMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const { changeOwnPassword, updateOwnProfile } = await import("./actions");

const OLD_PASSWORD = "OldPass123";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) {
    data.set(key, value);
  }
  return data;
}

beforeEach(async () => {
  vi.clearAllMocks();
  requireAdminMock.mockResolvedValue({
    id: "admin-1",
    name: "Admin Satu",
    email: "admin@sikesek.local",
    username: "admin",
    role: "ADMIN",
    mustChangePassword: true,
    hashedPassword: await bcrypt.hash(OLD_PASSWORD, 4),
  });
});

describe("changeOwnPassword", () => {
  it("rejects a wrong current password without writing anything", async () => {
    const result = await changeOwnPassword(
      formData({ currentPassword: "SalahSekali1", newPassword: "NewPass456" }),
    );

    expect(result.error).toBe("Kata sandi saat ini salah.");
    expect(updateMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("rejects a new password under 8 characters", async () => {
    const result = await changeOwnPassword(
      formData({ currentPassword: OLD_PASSWORD, newPassword: "pendek" }),
    );

    expect(result.error).toBe("Kata sandi baru minimal 8 karakter.");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a new password identical to the current one", async () => {
    const result = await changeOwnPassword(
      formData({ currentPassword: OLD_PASSWORD, newPassword: OLD_PASSWORD }),
    );

    expect(result.error).toBe(
      "Kata sandi baru harus berbeda dari kata sandi saat ini.",
    );
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("stores the new hash and clears mustChangePassword on success", async () => {
    const result = await changeOwnPassword(
      formData({ currentPassword: OLD_PASSWORD, newPassword: "NewPass456" }),
    );

    expect(result.error).toBeUndefined();
    expect(updateMock).toHaveBeenCalledTimes(1);

    const call = updateMock.mock.calls[0][0];
    expect(call.where).toEqual({ id: "admin-1" });
    expect(call.data.mustChangePassword).toBe(false);
    expect(await bcrypt.compare("NewPass456", call.data.hashedPassword)).toBe(
      true,
    );
    expect(await bcrypt.compare(OLD_PASSWORD, call.data.hashedPassword)).toBe(
      false,
    );

    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.password.changed",
        entityType: "User",
        entityId: "admin-1",
        actor: { id: "admin-1", name: "Admin Satu" },
      }),
    );
  });
});

describe("updateOwnProfile", () => {
  it("updates name, email, and phone with trimmed values", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await updateOwnProfile(
      formData({
        name: "  Admin Baru  ",
        email: "  baru@sikesek.local  ",
        phone: "  0812-3456-7890  ",
      }),
    );

    expect(result.error).toBeUndefined();
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { email: "baru@sikesek.local", id: { not: "admin-1" } },
      select: { id: true },
    });
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "admin-1" },
      data: {
        name: "Admin Baru",
        email: "baru@sikesek.local",
        phone: "0812-3456-7890",
      },
    });
    expect(logAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "user.profile.updated",
        entityType: "User",
        entityId: "admin-1",
        metadata: {
          name: "Admin Baru",
          email: "baru@sikesek.local",
          previousEmail: "admin@sikesek.local",
        },
      }),
    );
  });

  it("stores an empty phone number as null", async () => {
    findFirstMock.mockResolvedValue(null);

    const result = await updateOwnProfile(
      formData({
        name: "Admin Satu",
        email: "admin@sikesek.local",
        phone: "   ",
      }),
    );

    expect(result.error).toBeUndefined();
    expect(updateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ phone: null }) }),
    );
  });

  it("rejects an email already used by another account", async () => {
    findFirstMock.mockResolvedValue({ id: "other-admin" });

    const result = await updateOwnProfile(
      formData({
        name: "Admin Satu",
        email: "dipakai@sikesek.local",
        phone: "",
      }),
    );

    expect(result.error).toBe("Email sudah digunakan akun lain.");
    expect(updateMock).not.toHaveBeenCalled();
    expect(logAuditMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email before touching the database", async () => {
    const result = await updateOwnProfile(
      formData({ name: "Admin Satu", email: "bukan-email", phone: "" }),
    );

    expect(result.error).toBe("Format email tidak valid.");
    expect(findFirstMock).not.toHaveBeenCalled();
    expect(updateMock).not.toHaveBeenCalled();
  });
});
