/**
 * Central payment-window policy shared by the booking service, Snap client,
 * expiry job, and UI. Keeping these values in one place is what makes the
 * server deadline, the Midtrans Snap expiry, and the browser countdown agree.
 *
 * See docs/PAYMENT.md for the full lifecycle.
 */
export const PAYMENT_WINDOW_MINUTES = 5;
export const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60 * 1000;
export const PAYMENT_WINDOW_SECONDS = PAYMENT_WINDOW_MINUTES * 60;

export const LATE_PAYMENT_REFUND_REASON =
  "Automatic refund: payment settled after the 5-minute payment window.";

/** Deadline for a payment created at `now` (normally booking creation). */
export function paymentDeadlineFrom(now: Date = new Date()) {
  return new Date(now.getTime() + PAYMENT_WINDOW_MS);
}

export function isPaymentExpired(expiresAt: Date | null, now: Date = new Date()) {
  return expiresAt !== null && now.getTime() >= expiresAt.getTime();
}

/** Whole seconds left, rounded up so the countdown shows 05:00 at creation. */
export function remainingPaymentSeconds(expiresAt: Date, now: Date = new Date()) {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}

/** `MM:SS`, used by the public payment countdown. */
export function formatPaymentCountdown(seconds: number) {
  const safe = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safe / 60);
  const remainder = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

/**
 * Midtrans Snap `expiry.start_time` format: `YYYY-MM-DD HH:mm:ss +0700`
 * (Western Indonesian Time). The server runs in UTC, so add the fixed WIB
 * offset before formatting rather than relying on the host timezone.
 */
export function formatSnapStartTime(date: Date) {
  const wib = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return `${wib.toISOString().slice(0, 19).replace("T", " ")} +0700`;
}

/** Stable idempotency key so retrying a late-payment refund never duplicates it. */
export function latePaymentRefundKey(transactionId: string) {
  return `LATE-${transactionId}`;
}
