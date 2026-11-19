import { describe, expect, it } from "vitest";
import {
  addDaysKey,
  dashboardDateLabels,
  dateKeyInJakarta,
  relativeTime,
} from "./dates";

describe("dashboard WIB date helpers", () => {
  it("moves calendar keys without drifting across month boundaries", () => {
    expect(addDaysKey("2026-11-20", -13)).toBe("2026-11-07");
    expect(addDaysKey("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDaysKey("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("buckets by the WIB date, not the server's local date", () => {
    // 00:30 WIB on 20 Nov is still 19 Nov in UTC.
    expect(dateKeyInJakarta(new Date("2026-11-19T17:30:00Z"))).toBe("2026-11-20");
    expect(dateKeyInJakarta(new Date("2026-11-19T16:59:00Z"))).toBe("2026-11-19");
  });

  it("formats relative activity times", () => {
    const now = new Date("2026-11-20T03:00:00Z");
    expect(relativeTime(new Date("2026-11-20T02:59:30Z"), now)).toBe("baru saja");
    expect(relativeTime(new Date("2026-11-20T02:45:00Z"), now)).toBe("15 menit lalu");
    expect(relativeTime(new Date("2026-11-20T00:00:00Z"), now)).toBe("3 jam lalu");
    expect(relativeTime(new Date("2026-11-18T03:00:00Z"), now)).toBe("2 hari lalu");
  });

  it("renders today and updated-at labels in WIB", () => {
    const labels = dashboardDateLabels(new Date("2026-11-19T17:30:00Z"));
    expect(labels.todayLabel).toContain("2026");
    expect(labels.updatedAtLabel).toMatch(/00\.30 WIB/);
  });
});
