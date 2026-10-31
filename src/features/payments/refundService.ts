import { prisma } from "@/lib/prisma";
import { isMidtransApiError, refundTransaction } from "@/lib/midtrans";
import { logAudit, type AuditActor } from "@/lib/audit";
import { LATE_PAYMENT_REFUND_REASON, latePaymentRefundKey } from "@/lib/payment";

export class RefundError extends Error {}

/**
 * `paidAmount - successfullyRefundedAmount` (section 8) - `refundedAmount`
 * is a running total maintained transactionally in `confirmRefundSuccess`
 * below, so this never needs to re-sum Refund history on every read.
 */
export function refundableAmount(transaction: { totalAmount: bigint; refundedAmount: bigint }) {
  return Number(transaction.totalAmount) - Number(transaction.refundedAmount);
}

/**
 * Requests a refund against a PAID/PARTIALLY_REFUNDED transaction (sections
 * 8-11). Midtrans's refund endpoint responds synchronously with the
 * resulting `transaction_status` and `refund_amount` - that response is
 * treated as the authoritative confirmation of THIS specific refund attempt
 * (rather than waiting on an async webhook, which for refunds is not
 * reliably or uniformly sent by every payment channel); a later webhook
 * notification, if Midtrans does send one, is still handled distinctly
 * (see markLatestRefundBankConfirmed) so `bankConfirmedAt` reflects the
 * actual bank-confirmed follow-up rather than being conflated with this
 * initial confirmation.
 */
export async function requestRefund(input: {
  invoiceNumber: string;
  amount: number;
  reason?: string;
  /** Null for an automatic/system refund; a human actor otherwise. */
  admin: AuditActor | null;
  /** Marks the refund row as system-initiated in the admin UI. */
  automatic?: boolean;
  /** Override for a deterministic idempotency key (late-payment refunds). */
  refundKey?: string;
}): Promise<{ error?: string }> {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceNumber: input.invoiceNumber },
    include: { refunds: true },
  });
  if (!transaction) return { error: "Transaction not found." };

  if (transaction.paymentStatus !== "PAID" && transaction.paymentStatus !== "PARTIALLY_REFUNDED") {
    return {
      error:
        "Only a settled (PAID) transaction can be refunded. Pending/failed transactions should be cancelled instead.",
    };
  }

  const remaining = refundableAmount(transaction);
  if (input.amount <= 0 || input.amount > remaining) {
    return { error: `Refund amount must be between 1 and ${remaining}.` };
  }

  const refundKey = input.refundKey ?? `REF-${transaction.id}-${transaction.refunds.length + 1}`;
  const existing = transaction.refunds.find((refund) => refund.refundKey === refundKey);

  // A retried automatic refund reuses the same key. Midtrans itself treats
  // that key idempotently; this local guard prevents a duplicate row and a
  // duplicate `refundedAmount` increment while a request is genuinely in
  // flight. Stale PROCESSING rows may be retried after a short grace period
  // (e.g. a crashed request after Midtrans accepted it).
  if (existing?.status === "SUCCESS") return {};
  if (
    existing?.status === "PROCESSING" &&
    Date.now() - existing.updatedAt.getTime() < 2 * 60 * 1000
  ) {
    return { error: "A refund for this transaction is already being processed." };
  }

  const refund = existing
    ? await prisma.refund.update({
        where: { id: existing.id },
        data: { status: "PROCESSING", failureReason: null },
      })
    : await prisma.refund.create({
        data: {
          transactionId: transaction.id,
          refundKey,
          midtransTransactionId: transaction.midtransTransactionId,
          amount: input.amount,
          reason: input.reason,
          status: "PROCESSING",
          requestedByUserId: input.admin?.id ?? null,
          automatic: input.automatic ?? false,
        },
      });

  await logAudit({
    actor: input.admin,
    action: input.automatic ? "payment.late_refund_requested" : "payment.refund_requested",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: {
      refundId: refund.id,
      amount: input.amount,
      reason: input.reason ?? null,
      automatic: input.automatic ?? false,
    },
  });

  try {
    const result = await refundTransaction(input.invoiceNumber, {
      refundKey,
      amount: input.amount,
      reason: input.reason,
    });

    await confirmRefundSuccess(transaction.id, refund.id, input.amount, result.transaction_status, result.refund_chargeback_id);

    await logAudit({
      actor: input.admin,
      action: "payment.refund_confirmed",
      entityType: "Transaction",
      entityId: transaction.id,
      metadata: { refundId: refund.id, midtransStatus: result.transaction_status },
    });

    return {};
  } catch (error) {
    const message = isMidtransApiError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : "Unknown error";

    await prisma.refund.update({
      where: { id: refund.id },
      data: { status: "FAILED", failureReason: message },
    });

    await logAudit({
      actor: input.admin,
      action: input.automatic ? "payment.late_refund_failed" : "payment.refund_failed",
      entityType: "Transaction",
      entityId: transaction.id,
      metadata: { refundId: refund.id, error: message, automatic: input.automatic ?? false },
    });

    console.error("[Payment] Refund failed", {
      invoiceNumber: input.invoiceNumber,
      refundId: refund.id,
      errorMessage: message,
    });

    return { error: `Refund could not be processed: ${message}` };
  }
}

async function confirmRefundSuccess(
  transactionId: string,
  refundId: string,
  amount: number,
  midtransStatus: string,
  midtransRefundChargebackId?: number,
) {
  await prisma.$transaction(async (tx) => {
    // Claim this attempt atomically. If a concurrent retry already
    // confirmed the same refund, stop here instead of incrementing
    // `refundedAmount` twice.
    const claimed = await tx.refund.updateMany({
      where: { id: refundId, status: "PROCESSING" },
      data: {
        status: "SUCCESS",
        midtransStatus,
        midtransRefundChargebackId: midtransRefundChargebackId
          ? String(midtransRefundChargebackId)
          : undefined,
        confirmedAt: new Date(),
        failureReason: null,
      },
    });
    if (claimed.count === 0) return;

    const transaction = await tx.transaction.findUniqueOrThrow({ where: { id: transactionId } });
    const newRefundedAmount = Number(transaction.refundedAmount) + amount;
    const isFullyRefunded = newRefundedAmount >= Number(transaction.totalAmount);

    // A full refund cancels the underlying bookings, mirroring the
    // FAILED/EXPIRED -> CANCELLED behavior in paymentReconciliation.ts. A
    // partial refund leaves bookings/tickets alone - see
    // features/tickets/service.ts's ticket-validity gate for the
    // corresponding PARTIALLY_REFUNDED-stays-valid decision.
    await tx.transaction.update({
      where: { id: transactionId },
      data: {
        refundedAmount: newRefundedAmount,
        paymentStatus: isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    });

    if (!isFullyRefunded) return;

    await tx.transactionHomestay.updateMany({
      where: { transactionId, bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { bookingStatus: "CANCELLED" },
    });
    await tx.transactionVenue.updateMany({
      where: { transactionId, bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { bookingStatus: "CANCELLED" },
    });
    await tx.transactionEdutrip.updateMany({
      where: { transactionId, bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
      data: { bookingStatus: "CANCELLED" },
    });
  });
}

/**
 * Full automatic refund for a payment that settled after its deadline.
 *
 * The refundKey is deterministic (`LATE-<transactionId>`), so webhook
 * retries, the expiry job, and an admin retry all converge on one Midtrans
 * refund attempt. Any refund failure leaves the transaction PAID with
 * `latePaymentAt` set (never ticketed) so the admin payments page can show
 * and retry it.
 */
export async function requestAutomaticLatePaymentRefund(
  transactionId: string,
): Promise<{ error?: string }> {
  const transaction = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { refunds: true },
  });
  if (!transaction) return { error: "Transaction not found." };

  if (transaction.paymentStatus !== "PAID" && transaction.paymentStatus !== "PARTIALLY_REFUNDED") {
    return {
      error: "Late-payment refund requires a PAID transaction.",
    };
  }

  const remaining = refundableAmount(transaction);
  if (remaining <= 0) return {};

  return requestRefund({
    invoiceNumber: transaction.invoiceNumber,
    amount: remaining,
    reason: LATE_PAYMENT_REFUND_REASON,
    admin: null,
    automatic: true,
    refundKey: latePaymentRefundKey(transaction.id),
  });
}

export function getRefundsForTransaction(transactionId: string) {
  return prisma.refund.findMany({
    where: { transactionId },
    orderBy: { requestedAt: "desc" },
    include: { requestedBy: { select: { name: true } } },
  });
}
