import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    notification: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/auth/requireMobileAuth", () => ({
  requireMobileAuth: vi.fn(),
}));

const mockedRequireMobileAuth = vi.mocked(requireMobileAuth);

describe("GET /api/mobile/notifications", () => {
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
  });

  it("returns both KTR detections and booking reminder references", async () => {
    vi.mocked(prisma.notification.findMany).mockResolvedValue([
      {
        id: "notification-ktr",
        type: "KTR_VIOLATION_NEW",
        title: "KTR violation detected",
        body: "Location: Gazebo 1",
        sentAt: new Date("2026-10-31T14:47:34.260Z"),
        readAt: null,
        detectionId: "detection-1",
        detection: {
          id: "detection-1",
          area: { name: "Gazebo 1" },
        },
        bookingType: null,
        bookingId: null,
        invoiceNumber: null,
        metadata: null,
      },
      {
        id: "notification-booking",
        type: "BOOKING_ENDING_SOON",
        title: "Sewa fasilitas hampir berakhir",
        body: "15 menit lagi",
        sentAt: new Date("2026-11-01T09:45:00.000Z"),
        readAt: null,
        detectionId: null,
        detection: null,
        bookingType: "venue",
        bookingId: "booking-1",
        invoiceNumber: "INV-1",
        metadata: {
          eventType: "BOOKING_ENDING_SOON",
          facilityName: "Aula Utama",
          validUntil: "2026-11-01T10:00:00.000Z",
        },
      },
    ] as never);

    const response = await GET(
      new Request("http://localhost:3000/api/mobile/notifications"),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.items[0]).toMatchObject({
      type: "KTR_VIOLATION_NEW",
      detection: { id: "detection-1", areaName: "Gazebo 1" },
      booking: null,
    });
    expect(body.items[1]).toMatchObject({
      type: "BOOKING_ENDING_SOON",
      detection: null,
      booking: {
        bookingType: "venue",
        bookingId: "booking-1",
        invoiceNumber: "INV-1",
        eventType: "BOOKING_ENDING_SOON",
        facilityName: "Aula Utama",
        validUntil: "2026-11-01T10:00:00.000Z",
      },
    });
  });
});
