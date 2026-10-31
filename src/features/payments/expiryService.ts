import type { PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { expireSnapTransaction, isMidtransApiError } from "@/lib/midtrans";
import { PAYMENT_WINDOW_MS, isPaymentExpired } from "@/lib/payment";
import { reconcileFromMidtransGetStatus } from "@/features/booking/paymentReconciliation";

export interface ExpirePaymentResult {
  invoiceNumber: string;
  status: PaymentStatus | "NOT_FOUND";
  /** True when this call is what moved the local record to EXPIRED. */
  expired: boolean;
  /** False when the deadline has not passed yet (a safe no-op). */
  due: boolean;
  midtransExpireError?: string;
}

/**
 * Expire one overdue PENDING payment.
 *
 * Order of operations matters:
 *  1. Reconcile with Midtrans first. A settlement that arrived just before
 *     the deadline (or a webhook that was missed) must win over expiry, and
 *     the reconciliation path already handles a genuinely late payment by
 *     cancelling the booking and starting an automatic refund.
 *  2. Ask Midtrans to expire the Snap transaction. This is best-effort: the
 *     local deadline is authoritative for freeing the slot, and a payment
 *     that still slips through is covered by the late-payment refund path.
 *  3. Mark the local transaction EXPIRED with a conditional update so a
 *     concurrent webhook that already moved it to PAID is never overwritten.
 *  4. Cancel its still-open booking lines.
 */
export async function expirePendingPayment(
  invoiceNumber: string,
  now: Date = new Date(),
): Promise<ExpirePaymentResult> {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceNumber },
    select: {
      id: true,
      paymentStatus: true,
      paymentExpiresAt: true,
      createdAt: true,
    },
  });

  if (!transaction) {
    return { invoiceNumber, status: "NOT_FOUND", expired: false, due: false };
  }

  if (transaction.paymentStatus !== "PENDING") {
    return {
      invoiceNumber,
      status: transaction.paymentStatus,
      expired: transaction.paymentStatus === "EXPIRED",
      due: false,
    };
  }

  const deadline =
    transaction.paymentExpiresAt ??
    new Date(transaction.createdAt.getTime() + PAYMENT_WINDOW_MS);

  if (!isPaymentExpired(deadline, now)) {
    return { invoiceNumber, status: "PENDING", expired: false, due: false };
  }

  // A missing deadline on a legacy row is repaired here so the index and
  // admin views stay meaningful even before the row is expired below.
  if (!transaction.paymentExpiresAt) {
    await prisma.transaction.update({
      where: { id: transaction.id },
      data: { paymentExpiresAt: deadline },
    });
  }

  const reconciled = await reconcileFromMidtransGetStatus(invoiceNumber);
  if (reconciled.ok && reconciled.status !== "PENDING") {
    return {
      invoiceNumber,
      status: reconciled.status,
      expired: reconciled.status === "EXPIRED",
      due: true,
    };
  }

  if (!reconciled.ok) {
    console.error("[Payment] Could not reconcile before expiry; expiring local payment anyway", {
      invoiceNumber,
      reason: reconciled.reason,
    });
  }

  let midtransExpireError: string | undefined;
  try {
    await expireSnapTransaction(invoiceNumber);
  } catch (error) {
    midtransExpireError = isMidtransApiError(error)
      ? error.message
      : error instanceof Error
        ? error.message
        : String(error);
    // Best-effort: do not leave the slot held just because Midtrans is
    // temporarily unreachable. If the payment later settles, reconciliation
    // records it as late and refunds it automatically.
    console.error("[Payment] Midtrans expire call failed; expiring local payment anyway", {
      invoiceNumber,
      errorMessage: midtransExpireError,
    });
  }

  const updated = await prisma.transaction.updateMany({
    where: { id: transaction.id, paymentStatus: "PENDING" },
    data: { paymentStatus: "EXPIRED" },
  });

  if (updated.count === 0) {
    const current = await prisma.transaction.findUnique({
      where: { id: transaction.id },
      select: { paymentStatus: true },
    });
    return {
      invoiceNumber,
      status: current?.paymentStatus ?? "PENDING",
      expired: current?.paymentStatus === "EXPIRED",
      due: true,
      midtransExpireError,
    };
  }

  await prisma.$transaction([
    prisma.transactionHomestay.updateMany({
      where: {
        transactionId: transaction.id,
        bookingStatus: { in: ["PENDING", "CONFIRMED"] },
      },
      data: { bookingStatus: "CANCELLED" },
    }),
    prisma.transactionVenue.updateMany({
      where: {
        transactionId: transaction.id,
        bookingStatus: { in: ["PENDING", "CONFIRMED"] },
      },
      data: { bookingStatus: "CANCELLED" },
    }),
    prisma.transactionEdutrip.updateMany({
      where: {
        transactionId: transaction.id,
        bookingStatus: { in: ["PENDING", "CONFIRMED"] },
      },
      data: { bookingStatus: "CANCELLED" },
    }),
  ]);

  await logAudit({
    actor: null,
    action: "payment.expired",
    entityType: "Transaction",
    entityId: transaction.id,
    metadata: {
      invoiceNumber,
      paymentExpiresAt: deadline.toISOString(),
      midtransExpireError: midtransExpireError ?? null,
    },
  });

  console.log("[Payment] Expired overdue payment", { invoiceNumber, midtransExpireError });
  return { invoiceNumber, status: "EXPIRED", expired: true, due: true, midtransExpireError };
}

export interface ExpirePaymentsSummary {
  scanned: number;
  expired: number;
  skipped: number;
  failed: number;
}

/**
 * Batch entry point used by the cron endpoint. `limit` bounds a single run;
 * any remaining overdue rows are picked up by the next invocation.
 */
export async function expirePendingPayments(
  limit = 100,
  now: Date = new Date(),
): Promise<ExpirePaymentsSummary> {
  const legacyCutoff = new Date(now.getTime() - PAYMENT_WINDOW_MS);
  const candidates = await prisma.transaction.findMany({
    where: {
      paymentStatus: "PENDING",
      OR: [
        { paymentExpiresAt: { lte: now } },
        { paymentExpiresAt: null, createdAt: { lte: legacyCutoff } },
      ],
    },
    select: { invoiceNumber: true },
    orderBy: { paymentExpiresAt: "asc" },
    take: limit,
  });

  const summary: ExpirePaymentsSummary = {
    scanned: candidates.length,
    expired: 0,
    skipped: 0,
    failed: 0,
  };

  for (const candidate of candidates) {
    try {
      const result = await expirePendingPayment(candidate.invoiceNumber, now);
      if (result.expired) summary.expired += 1;
      else summary.skipped += 1;
    } catch (error) {
      summary.failed += 1;
      console.error("[Payment] Failed to expire payment", {
        invoiceNumber: candidate.invoiceNumber,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }

  console.log("[Payment] Expiry run complete", summary);
  return summary;
}
