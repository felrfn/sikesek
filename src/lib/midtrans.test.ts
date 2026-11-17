import { afterEach, describe, expect, it, vi } from "vitest";

const { snapInstances } = vi.hoisted(() => ({
  snapInstances: [] as Array<{ config: { isProduction: boolean } }>,
}));

vi.mock("midtrans-client", () => ({
  Snap: class {
    config: { isProduction: boolean };
    constructor(config: { isProduction: boolean }) {
      this.config = config;
      snapInstances.push(this);
    }
    createTransaction = vi.fn(async () => ({
      token: "snap-token",
      redirect_url: "https://example.test/snap",
    }));
  },
}));

import { createSnapTransaction, isMidtransProduction } from "./midtrans";

describe("midtrans environment selection", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    snapInstances.length = 0;
  });

  it("stays on sandbox in production mode unless MIDTRANS_IS_PRODUCTION is true", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MIDTRANS_IS_PRODUCTION", "");

    expect(isMidtransProduction()).toBe(false);
  });

  it("only treats the literal value true as production", () => {
    vi.stubEnv("MIDTRANS_IS_PRODUCTION", "false");
    expect(isMidtransProduction()).toBe(false);

    vi.stubEnv("MIDTRANS_IS_PRODUCTION", "1");
    expect(isMidtransProduction()).toBe(false);

    vi.stubEnv("MIDTRANS_IS_PRODUCTION", "true");
    expect(isMidtransProduction()).toBe(true);
  });

  it("configures the Snap client from MIDTRANS_IS_PRODUCTION, not NODE_ENV", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("MIDTRANS_SERVER_KEY", "test-server-key");
    vi.stubEnv("MIDTRANS_IS_PRODUCTION", "false");

    await createSnapTransaction({
      invoiceNumber: "INV-TEST",
      grossAmount: 200000,
      customerName: "Test",
      customerEmail: "test@example.com",
      customerPhone: "08123456789",
      itemDetails: [{ id: "item-1", name: "Venue", price: 200000 }],
      expiresAt: new Date(Date.now() + 5 * 60_000),
    });

    expect(snapInstances).toHaveLength(1);
    expect(snapInstances[0]?.config.isProduction).toBe(false);
  });
});
