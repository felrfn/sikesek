import { describe, expect, it } from "vitest";
import {
  LATE_PAYMENT_REFUND_REASON,
  PAYMENT_WINDOW_MINUTES,
  effectiveBookingStatus,
  effectivePaymentStatus,
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

describe("effective payment status", () => {
  const deadline = new Date("2026-10-30T01:05:00Z");

  it("reports an overdue pending payment as expired before the job runs", () => {
    expect(
      effectivePaymentStatus("PENDING", deadline, new Date("2026-10-30T01:05:01Z")),
    ).toBe("EXPIRED");
    expect(
      effectivePaymentStatus("PENDING", deadline, new Date("2026-10-30T01:04:59Z")),
    ).toBe("PENDING");
  });

  it("never overrides a settled or already terminal status", () => {
    expect(effectivePaymentStatus("PAID", deadline, new Date("2026-10-31T00:00:00Z"))).toBe(
      "PAID",
    );
    expect(effectivePaymentStatus("PENDING", null, new Date("2026-10-31T00:00:00Z"))).toBe(
      "PENDING",
    );
  });

  it("cancels open booking lines of an overdue pending payment", () => {
    expect(
      effectiveBookingStatus(
        "PENDING",
        "PENDING",
        deadline,
        new Date("2026-10-30T01:05:01Z"),
      ),
    ).toBe("CANCELLED");
    expect(
      effectiveBookingStatus(
        "CONFIRMED",
        "PENDING",
        deadline,
        new Date("2026-10-30T01:05:01Z"),
      ),
    ).toBe("CANCELLED");
    expect(
      effectiveBookingStatus(
        "COMPLETED",
        "PENDING",
        deadline,
        new Date("2026-10-30T01:05:01Z"),
      ),
    ).toBe("COMPLETED");
    expect(
      effectiveBookingStatus(
        "PENDING",
        "PAID",
        deadline,
        new Date("2026-10-30T01:05:01Z"),
      ),
    ).toBe("PENDING");
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
