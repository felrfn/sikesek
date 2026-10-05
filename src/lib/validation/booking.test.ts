import { describe, expect, it } from "vitest";
import { facilityAvailabilityQuerySchema } from "./booking";
import { getMaxBookableDate, getTodayInJakarta } from "@/lib/siteConfig";

const today = getTodayInJakarta();

describe("facilityAvailabilityQuerySchema", () => {
  it("accepts a bare date with no category/time range", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({ date: today });
    expect(result.success).toBe(true);
  });

  it("accepts a date with category and a valid paired hour range", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({
      date: today,
      category: "venue",
      startHour: 9,
      endHour: 11,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a date outside the 90-day bookable window", () => {
    const tooFar = new Date(`${getMaxBookableDate(today)}T00:00:00.000Z`);
    tooFar.setUTCDate(tooFar.getUTCDate() + 1);

    const result = facilityAvailabilityQuerySchema.safeParse({
      date: tooFar.toISOString().slice(0, 10),
    });
    expect(result.success).toBe(false);
  });

  it("rejects startHour given without endHour", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({ date: today, startHour: 9 });
    expect(result.success).toBe(false);
  });

  it("rejects endHour given without startHour", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({ date: today, endHour: 11 });
    expect(result.success).toBe(false);
  });

  it("rejects endHour not strictly after startHour", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({
      date: today,
      startHour: 11,
      endHour: 11,
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown category", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({ date: today, category: "hotel" });
    expect(result.success).toBe(false);
  });
});
