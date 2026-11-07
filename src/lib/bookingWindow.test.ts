import { describe, expect, it } from "vitest";
import {
  getHomestayRentalWindow,
  getVenueRentalWindow,
  getEdutripRentalWindow,
} from "./bookingWindow";
import { HOMESTAY_CHECK_IN_HOUR, HOMESTAY_CHECK_OUT_HOUR } from "./siteConfig";

describe("getHomestayRentalWindow", () => {
  it("produces a true UTC instant for HOMESTAY_CHECK_IN_HOUR, so a visitor arriving at that WIB wall-clock hour is already inside the window (regression: a HOMESTAY_CHECK_IN_HOUR=13 check-in was reading as 13:00 UTC = 20:00 WIB, leaving tickets 'not valid yet' for 7 extra hours)", () => {
    const checkInDate = new Date("2026-10-06T00:00:00.000Z");
    const checkOutDate = new Date("2026-10-07T00:00:00.000Z");
    const { validFrom, validUntil } = getHomestayRentalWindow(checkInDate, checkOutDate);

    expect(validFrom.toISOString()).toBe(
      `2026-10-06T${String(HOMESTAY_CHECK_IN_HOUR - 7).padStart(2, "0")}:00:00.000Z`,
    );
    expect(validUntil.toISOString()).toBe(
      `2026-10-07T${String(HOMESTAY_CHECK_OUT_HOUR - 7).padStart(2, "0")}:00:00.000Z`,
    );

    // A real wall-clock instant at exactly HOMESTAY_CHECK_IN_HOUR WIB on the
    // check-in day must already be >= validFrom.
    const arrivalAtCheckInHourWib = new Date(
      `2026-10-06T${String(HOMESTAY_CHECK_IN_HOUR - 7).padStart(2, "0")}:00:00.000Z`,
    );
    expect(arrivalAtCheckInHourWib >= validFrom).toBe(true);

    // One minute before that WIB hour must still be outside the window.
    const oneMinuteEarly = new Date(arrivalAtCheckInHourWib.getTime() - 60_000);
    expect(oneMinuteEarly >= validFrom).toBe(false);
  });
});

describe("getVenueRentalWindow", () => {
  it("converts a venue's WIB startTime/endTime hours to true UTC instants", () => {
    const bookingDate = new Date("2026-10-06T00:00:00.000Z");
    const startTime = new Date("1970-01-01T09:00:00.000Z"); // 09:00 WIB
    const endTime = new Date("1970-01-01T11:00:00.000Z"); // 11:00 WIB
    const { validFrom, validUntil } = getVenueRentalWindow(bookingDate, startTime, endTime);

    expect(validFrom.toISOString()).toBe("2026-10-06T02:00:00.000Z");
    expect(validUntil.toISOString()).toBe("2026-10-06T04:00:00.000Z");
  });
});

describe("getEdutripRentalWindow", () => {
  it("keeps the whole WIB calendar day inside the window as true UTC instants", () => {
    const visitDate = new Date("2026-10-06T00:00:00.000Z");
    const { validFrom, validUntil } = getEdutripRentalWindow(visitDate);

    expect(validFrom.toISOString()).toBe("2026-10-06T01:00:00.000Z"); // 08:00 WIB on 2026-10-06
    expect(validUntil.toISOString()).toBe("2026-10-06T10:00:00.000Z"); // 17:00 WIB on 2026-10-06
  });
});
