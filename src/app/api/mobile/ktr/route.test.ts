import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import { resolveEvidenceUrl } from "@/lib/storage/r2";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    smokingDetection: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth/requireMobileAuth", () => ({
  requireMobileAuth: vi.fn(),
}));

vi.mock("@/lib/storage/r2", () => ({
  resolveEvidenceUrl: vi.fn(),
  StorageNotConfiguredError: class StorageNotConfiguredError extends Error {},
}));

const mockedRequireMobileAuth = vi.mocked(requireMobileAuth);
const mockedResolveEvidenceUrl = vi.mocked(resolveEvidenceUrl);

describe("GET /api/mobile/ktr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedRequireMobileAuth.mockResolvedValue({
      ok: true,
      user: {
        id: "officer-1",
        role: "FIELD_OFFICER",
        name: "Jane",
        email: "jane@example.com",
        mustChangePassword: false,
      },
    });
    vi.mocked(prisma.smokingDetection.findMany).mockResolvedValue([
      {
        id: "detection-1",
        areaId: "area-1",
        area: { id: "area-1", name: "Gazebo 1" },
        confidence: 0.47,
        status: "RESOLVED",
        evidenceKey:
          "https://res.cloudinary.com/account/image/upload/v1793458053/sikesek_bukti/frame.jpg",
        handlingByUser: null,
        resolvedByUser: { id: "officer-2", name: "John" },
        handlingStartedAt: null,
        detectedAt: new Date("2026-10-31T14:47:34.260Z"),
        resolvedAt: new Date("2026-10-31T15:10:16.672Z"),
        notes: null,
      },
    ] as never);
    mockedResolveEvidenceUrl.mockResolvedValue(
      "https://res.cloudinary.com/account/image/upload/v1793458053/sikesek_bukti/frame.jpg",
    );
  });

  it("returns external evidence URLs unchanged", async () => {
    const response = await GET(new Request("http://localhost:3000/api/mobile/ktr"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockedResolveEvidenceUrl).toHaveBeenCalledWith(
      "https://res.cloudinary.com/account/image/upload/v1793458053/sikesek_bukti/frame.jpg",
    );
    expect(body.items[0].evidenceUrl).toBe(
      "https://res.cloudinary.com/account/image/upload/v1793458053/sikesek_bukti/frame.jpg",
    );
  });
});
