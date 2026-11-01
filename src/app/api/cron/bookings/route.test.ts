import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendBookingRemindersMock = vi.fn();

vi.mock("@/features/bookings/reminderService", () => ({
  sendBookingReminders: sendBookingRemindersMock,
}));

const { GET } = await import("./route");

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = "test-secret";
  sendBookingRemindersMock.mockResolvedValue({
    candidates: 1,
    sent: 1,
    skipped: 0,
    failed: 0,
  });
});

afterEach(() => {
  delete process.env.CRON_SECRET;
});

describe("GET /api/cron/bookings", () => {
  it("fails closed without the bearer secret", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/cron/bookings"),
    );

    expect(response.status).toBe(401);
    expect(sendBookingRemindersMock).not.toHaveBeenCalled();
  });

  it("runs reminders with the configured secret", async () => {
    const response = await GET(
      new Request("http://localhost:3000/api/cron/bookings", {
        headers: { authorization: "Bearer test-secret" },
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      candidates: 1,
      sent: 1,
      skipped: 0,
      failed: 0,
    });
    expect(sendBookingRemindersMock).toHaveBeenCalledTimes(1);
  });
});
