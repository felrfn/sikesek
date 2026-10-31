import { describe, expect, it } from "vitest";
import { monitoredAreaInputSchema } from "./ktr";

const valid = {
  name: "Gazebo 01",
  locationDescription: "North side",
  streamUrl: "rtsp://camera.local/gazebo-01",
  isActive: true,
};

describe("monitoredAreaInputSchema", () => {
  it("accepts a valid RTSP area", () => {
    const parsed = monitoredAreaInputSchema.safeParse(valid);
    expect(parsed.success).toBe(true);
  });

  it("accepts an area without a stream URL", () => {
    const parsed = monitoredAreaInputSchema.safeParse({
      name: "Gazebo 01",
      isActive: true,
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.streamUrl).toBeUndefined();
  });

  it("accepts an empty stream URL as not registered", () => {
    const parsed = monitoredAreaInputSchema.safeParse({
      name: "Gazebo 01",
      streamUrl: "",
      isActive: true,
    });
    expect(parsed.success).toBe(true);
  });

  it("accepts http/https streams and omits optional fields", () => {
    for (const streamUrl of [
      "http://camera.local/stream.m3u8",
      "https://camera.local/stream.m3u8",
      "rtmp://camera.local/live",
    ]) {
      expect(
        monitoredAreaInputSchema.safeParse({ name: "Area", streamUrl }).success,
      ).toBe(true);
    }
  });

  it("rejects an empty name", () => {
    const parsed = monitoredAreaInputSchema.safeParse({ ...valid, name: "  " });
    expect(parsed.success).toBe(false);
  });

  it("rejects unsupported or malformed stream URLs", () => {
    for (const streamUrl of ["ftp://camera.local/stream", "not a url"]) {
      const parsed = monitoredAreaInputSchema.safeParse({
        ...valid,
        streamUrl,
      });
      expect(parsed.success).toBe(false);
    }
  });

  it("defaults isActive to true", () => {
    const parsed = monitoredAreaInputSchema.parse({
      name: "Area",
      streamUrl: "rtsp://camera.local/stream",
    });
    expect(parsed.isActive).toBe(true);
  });

  it("rejects a non-UUID assigned officer", () => {
    const parsed = monitoredAreaInputSchema.safeParse({
      ...valid,
      assignedEmployeeId: "jane",
    });
    expect(parsed.success).toBe(false);
  });
});
