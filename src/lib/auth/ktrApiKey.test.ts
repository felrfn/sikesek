import { afterEach, describe, expect, it, vi } from "vitest";
import { isValidKtrApiKey } from "./ktrApiKey";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("isValidKtrApiKey", () => {
  it("accepts an exact match", () => {
    expect(isValidKtrApiKey("super-secret", "super-secret")).toBe(true);
  });

  it("rejects a different key of the same length", () => {
    expect(isValidKtrApiKey("super-secret", "super-secreT")).toBe(false);
  });

  it("rejects a key with a different length", () => {
    expect(isValidKtrApiKey("short", "a-much-longer-secret")).toBe(false);
  });

  it("rejects a missing provided key", () => {
    expect(isValidKtrApiKey(null, "super-secret")).toBe(false);
    expect(isValidKtrApiKey("", "super-secret")).toBe(false);
  });

  it("fails closed when the expected key is not configured", () => {
    vi.stubEnv("KTR_INGEST_API_KEY", "");
    expect(isValidKtrApiKey("anything")).toBe(false);
  });

  it("falls back to KTR_INGEST_API_KEY from the environment", () => {
    vi.stubEnv("KTR_INGEST_API_KEY", "env-secret");
    expect(isValidKtrApiKey("env-secret")).toBe(true);
    expect(isValidKtrApiKey("other-secret")).toBe(false);
  });
});
