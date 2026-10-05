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

  it("accepts a valid startDate/endDate range with no `date`", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({
      startDate: today,
      endDate: getMaxBookableDate(today),
    });
    expect(result.success).toBe(true);
  });

  it("rejects when both `date` and `startDate`/`endDate` are given", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({
      date: today,
      startDate: today,
      endDate: today,
    });
    expect(result.success).toBe(false);
  });

  it("rejects when neither `date` nor `startDate`/`endDate` is given", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({ category: "venue" });
    expect(result.success).toBe(false);
  });

  it("rejects startDate given without endDate", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({ startDate: today });
    expect(result.success).toBe(false);
  });

  it("rejects endDate given without startDate", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({ endDate: today });
    expect(result.success).toBe(false);
  });

  it("rejects endDate before startDate", () => {
    const tomorrow = new Date(`${today}T00:00:00.000Z`);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

    const result = facilityAvailabilityQuerySchema.safeParse({
      startDate: tomorrow.toISOString().slice(0, 10),
      endDate: today,
    });
    expect(result.success).toBe(false);
  });

  it("accepts startDate equal to endDate (a one-day range)", () => {
    const result = facilityAvailabilityQuerySchema.safeParse({ startDate: today, endDate: today });
    expect(result.success).toBe(true);
  });
});
