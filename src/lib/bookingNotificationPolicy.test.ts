import { describe, expect, it } from "vitest";
import {
  HOMESTAY_CHECK_IN_GRACE_MINUTES,
  RENTAL_ENDING_SOON_MINUTES,
  VENUE_CHECK_IN_GRACE_MINUTES,
  getCheckInDeadline,
  rentalEndingSoonAt,
} from "./bookingNotificationPolicy";

describe("booking notification policy", () => {
  it("uses a 15 minute ending-soon window", () => {
    expect(RENTAL_ENDING_SOON_MINUTES).toBe(15);
    expect(
      rentalEndingSoonAt(new Date("2026-11-01T10:00:00.000Z")).toISOString(),
    ).toBe("2026-11-01T09:45:00.000Z");
  });

  it("uses a 2 hour homestay check-in grace and a 15 minute venue grace", () => {
    const validFrom = new Date("2026-11-01T06:00:00.000Z");

    expect(HOMESTAY_CHECK_IN_GRACE_MINUTES).toBe(120);
    expect(VENUE_CHECK_IN_GRACE_MINUTES).toBe(15);
    expect(getCheckInDeadline("homestay", validFrom).toISOString()).toBe(
      "2026-11-01T08:00:00.000Z",
    );
    expect(getCheckInDeadline("venue", validFrom).toISOString()).toBe(
      "2026-11-01T06:15:00.000Z",
    );
  });
});
