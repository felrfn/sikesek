import { describe, expect, it } from "vitest";
import {
  LATE_PAYMENT_REFUND_REASON,
  PAYMENT_WINDOW_MINUTES,
  formatPaymentCountdown,
  formatSnapStartTime,
  isPaymentExpired,
  latePaymentRefundKey,
  paymentDeadlineFrom,
  remainingPaymentSeconds,
} from "./payment";

describe("payment window policy", () => {
  it("uses a five-minute payment window", () => {
    expect(PAYMENT_WINDOW_MINUTES).toBe(5);
    expect(paymentDeadlineFrom(new Date("2026-10-30T01:00:00Z"))).toEqual(
      new Date("2026-10-30T01:05:00Z"),
    );
  });

  it("detects an expired payment deadline", () => {
    const expiresAt = new Date("2026-10-30T01:05:00Z");
    expect(isPaymentExpired(expiresAt, new Date("2026-10-30T01:04:59Z"))).toBe(false);
    expect(isPaymentExpired(expiresAt, new Date("2026-10-30T01:05:00Z"))).toBe(true);
    expect(isPaymentExpired(null, new Date())).toBe(false);
  });

  it("computes and formats remaining countdown seconds", () => {
    expect(
      remainingPaymentSeconds(new Date("2026-10-30T01:05:00Z"), new Date("2026-10-30T01:00:00Z")),
    ).toBe(300);
    expect(remainingPaymentSeconds(new Date("2026-10-30T01:04:59Z"), new Date("2026-10-30T01:00:00Z"))).toBe(299);
    expect(formatPaymentCountdown(0)).toBe("00:00");
    expect(formatPaymentCountdown(5)).toBe("00:05");
    expect(formatPaymentCountdown(65)).toBe("01:05");
  });
});

describe("Midtrans Snap expiry", () => {
  it("formats an explicit start time in WIB", () => {
    expect(formatSnapStartTime(new Date("2026-10-30T08:00:00Z"))).toBe(
      "2026-10-30 15:00:00 +0700",
    );
  });
});

describe("late payment refund idempotency", () => {
  it("uses a deterministic refund key per transaction", () => {
    expect(latePaymentRefundKey("tx-1")).toBe("LATE-tx-1");
    expect(LATE_PAYMENT_REFUND_REASON).toContain("Automatic refund");
  });
});
