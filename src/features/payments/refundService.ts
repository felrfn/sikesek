import { prisma } from "@/lib/prisma";
import { isMidtransApiError, refundTransaction } from "@/lib/midtrans";
import { logAudit, type AuditActor } from "@/lib/audit";

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
  admin: AuditActor;
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

  const refundKey = `REF-${transaction.id}-${transaction.refunds.length + 1}`;

  const refund = await prisma.refund.create({
    data: {
      transactionId: transaction.id,
      refundKey,
      midtransTransactionId: transaction.midtransTransactionId,
      amount: input.amount,
      reason: input.reason,
      status: "PROCESSING",
      requestedByUserId: input.admin.id,
    },
  });

  await logAudit({
    actor: input.admin,
    action: "payment.refund_requested",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: { refundId: refund.id, amount: input.amount, reason: input.reason ?? null },
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
      action: "payment.refund_failed",
      entityType: "Transaction",
      entityId: transaction.id,
      metadata: { refundId: refund.id, error: message },
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
  const transaction = await prisma.transaction.findUniqueOrThrow({ where: { id: transactionId } });
  const newRefundedAmount = Number(transaction.refundedAmount) + amount;
  const isFullyRefunded = newRefundedAmount >= Number(transaction.totalAmount);

  // A full refund cancels the underlying bookings, mirroring the
  // FAILED/EXPIRED -> CANCELLED behavior in paymentReconciliation.ts. A
  // partial refund leaves bookings/tickets alone - see
  // features/tickets/service.ts's ticket-validity gate for the
  // corresponding PARTIALLY_REFUNDED-stays-valid decision.
  await prisma.$transaction([
    prisma.refund.update({
      where: { id: refundId },
      data: {
        status: "SUCCESS",
        midtransStatus,
        midtransRefundChargebackId: midtransRefundChargebackId
          ? String(midtransRefundChargebackId)
          : undefined,
        confirmedAt: new Date(),
      },
    }),
    prisma.transaction.update({
      where: { id: transactionId },
      data: {
        refundedAmount: newRefundedAmount,
        paymentStatus: isFullyRefunded ? "REFUNDED" : "PARTIALLY_REFUNDED",
      },
    }),
    ...(isFullyRefunded
      ? [
          prisma.transactionHomestay.updateMany({
            where: { transactionId, bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
            data: { bookingStatus: "CANCELLED" as const },
          }),
          prisma.transactionVenue.updateMany({
            where: { transactionId, bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
            data: { bookingStatus: "CANCELLED" as const },
          }),
          prisma.transactionEdutrip.updateMany({
            where: { transactionId, bookingStatus: { notIn: ["CANCELLED", "COMPLETED"] } },
            data: { bookingStatus: "CANCELLED" as const },
          }),
        ]
      : []),
  ]);
}

export function getRefundsForTransaction(transactionId: string) {
  return prisma.refund.findMany({
    where: { transactionId },
    orderBy: { requestedAt: "desc" },
    include: { requestedBy: { select: { name: true } } },
  });
}
