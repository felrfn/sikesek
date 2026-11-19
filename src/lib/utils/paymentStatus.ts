/**
 * Shared Indonesian labels and badge tones for payment/refund statuses.
 * Pure data (no Prisma/React imports) so both the payments module and the
 * bookings table can render the same wording and colors.
 */

export type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

export const PAYMENT_STATUS_OPTIONS = [
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
] as const;

export const PAYMENT_STATUS_META: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  PAID: { label: "Paid", tone: "success" },
  PENDING: { label: "Pending", tone: "warning" },
  EXPIRED: { label: "Expired", tone: "neutral" },
  FAILED: { label: "Failed", tone: "danger" },
  PARTIALLY_REFUNDED: { label: "Partially refunded", tone: "info" },
  REFUNDED: { label: "Refunded", tone: "info" },
};

export function paymentStatusLabel(status: string) {
  return PAYMENT_STATUS_META[status]?.label ?? status.replaceAll("_", " ");
}

export function paymentStatusTone(status: string): BadgeTone {
  return PAYMENT_STATUS_META[status]?.tone ?? "neutral";
}

export const REFUND_STATUS_META: Record<
  string,
  { label: string; tone: BadgeTone }
> = {
  PENDING: { label: "Pending", tone: "neutral" },
  PROCESSING: { label: "Processing", tone: "warning" },
  SUCCESS: { label: "Success", tone: "success" },
  FAILED: { label: "Failed", tone: "danger" },
};

export function refundStatusLabel(status: string) {
  return REFUND_STATUS_META[status]?.label ?? status.replaceAll("_", " ");
}

export function refundStatusTone(status: string): BadgeTone {
  return REFUND_STATUS_META[status]?.tone ?? "neutral";
}
