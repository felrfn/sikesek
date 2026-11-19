import { beforeEach, describe, expect, it, vi } from "vitest";

const findFirstMock = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findFirst: findFirstMock } },
}));

const { getPublicContact } = await import("./publicContact");
const { PUBLIC_CONTACT_FALLBACK } = await import("@/lib/siteConfig");

describe("getPublicContact", () => {
  beforeEach(() => {
    findFirstMock.mockReset();
  });

  it("reads both phone and email from the built-in admin account", async () => {
    findFirstMock.mockResolvedValue({
      phone: " 0812-3456-7890 ",
      email: " admin@sikesek.local ",
    });

    await expect(getPublicContact()).resolves.toEqual({
      phone: "0812-3456-7890",
      email: "admin@sikesek.local",
    });
    expect(findFirstMock).toHaveBeenCalledWith({
      where: { username: "admin", role: "ADMIN", deletedAt: null },
      select: { phone: true, email: true },
    });
  });

  it("falls back per field when the admin profile is incomplete", async () => {
    findFirstMock.mockResolvedValue({ phone: "   ", email: "" });

    await expect(getPublicContact()).resolves.toEqual({
      phone: PUBLIC_CONTACT_FALLBACK.phone,
      email: PUBLIC_CONTACT_FALLBACK.email,
    });
  });

  it("falls back when the admin account does not exist", async () => {
    findFirstMock.mockResolvedValue(null);

    await expect(getPublicContact()).resolves.toEqual({
      ...PUBLIC_CONTACT_FALLBACK,
    });
  });

  it("falls back when the database query fails", async () => {
    findFirstMock.mockRejectedValue(new Error("database unavailable"));

    await expect(getPublicContact()).resolves.toEqual({
      ...PUBLIC_CONTACT_FALLBACK,
    });
  });
});
