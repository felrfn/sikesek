import type { BookingStatus, PaymentStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  getTransactionStatus,
  isForwardTransition,
  mapMidtransStatus,
} from "@/lib/midtrans";
import { createTicketsForTransaction } from "@/features/tickets/service";
import { sendBookingConfirmationEmail } from "@/features/booking/confirmationEmail";

export interface MidtransStatusPayload {
  transaction_status: string;
  fraud_status?: string;
  gross_amount: string;
  payment_type?: string;
  transaction_id?: string;
}

export type ReconciliationResult =
  | { ok: true; status: PaymentStatus; changed: boolean }
  | { ok: false; reason: "NOT_FOUND" | "AMOUNT_MISMATCH" };

/**
 * The single place that turns "what Midtrans just told us" into "what our
 * database says" - both the webhook handler and the Get Status API
 * reconciliation path (used by /booking/success and the admin payments
 * page) call this, so there is exactly one implementation of: the status
 * mapping, the amount check, the out-of-order-notification guard, and
 * automatic ticket issuance. See docs/MOBILE_API.md's payment status table
 * and .ai/RULES.md ยง6 for the product rules this encodes.
 */
export async function reconcileTransactionStatus(
  orderId: string,
  payload: MidtransStatusPayload,
  source: "webhook" | "get-status",
): Promise<ReconciliationResult> {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceNumber: orderId },
  });

  console.log("[Midtrans] Notification received", {
    orderId,
    transactionId: payload.transaction_id,
    status: payload.transaction_status,
    fraudStatus: payload.fraud_status,
    grossAmount: payload.gross_amount,
    source,
  });

  if (!transaction) {
    console.error("[Payment] No local transaction for order_id", { orderId, source });
    return { ok: false, reason: "NOT_FOUND" };
  }

  const nextStatus = mapMidtransStatus(payload.transaction_status, payload.fraud_status);
  if (!nextStatus) {
    console.log("[Payment] Midtrans status has no mapped effect, ignoring", {
      orderId,
      midtransStatus: payload.transaction_status,
    });
    return { ok: true, status: transaction.paymentStatus, changed: false };
  }

  // Section 17: a booking must never be marked PAID for the wrong amount -
  // this is what would have silently hidden the earlier cross-booking
  // amount-mismatch bug if it were still possible to hit.
  const expectedAmount = Number(transaction.totalAmount);
  const reportedAmount = Math.round(Number(payload.gross_amount));
  if (nextStatus === "PAID" && expectedAmount !== reportedAmount) {
    console.error("[Payment] AMOUNT MISMATCH - refusing to mark PAID", {
      orderId,
      expectedAmount,
      reportedAmount,
      source,
    });
    return { ok: false, reason: "AMOUNT_MISMATCH" };
  }

  if (!isForwardTransition(transaction.paymentStatus, nextStatus)) {
    if (transaction.paymentStatus !== nextStatus) {
      // An out-of-order/stale notification trying to move the status
      // backwards (e.g. a late "pending" after we already saw
      // "settlement") - ignored, never applied.
      console.log("[Payment] Ignored non-forward status transition", {
        orderId,
        current: transaction.paymentStatus,
        attempted: nextStatus,
        source,
      });
    }
    // Same status repeated (the common idempotent case: Midtrans resent
    // the same "settlement" notification, or Get Status was called on an
    // already-reconciled transaction) - nothing to do.
    return { ok: true, status: transaction.paymentStatus, changed: false };
  }

  console.log("[Payment] Status transition", {
    orderId,
    from: transaction.paymentStatus,
    to: nextStatus,
    source,
  });

  await applyStatusTransition(transaction.id, nextStatus, payload);

  if (nextStatus === "PAID") {
    // Both idempotent: createTicketsForTransaction no-ops if tickets
    // already exist (see its own doc comment), and a repeated email send
    // is a real duplicate email, which is why this only runs on an actual
    // PENDING -> PAID transition, never on a same-status no-op above.
    await createTicketsForTransaction(transaction.id);
    console.log("[Ticket] Issued for transaction", { orderId, bookingId: transaction.id });
    await sendBookingConfirmationEmail(transaction.id).catch((error) =>
      console.error("Failed to send booking confirmation email:", error),
    );
  }

  return { ok: true, status: nextStatus, changed: true };
}

async function applyStatusTransition(
  transactionId: string,
  nextStatus: PaymentStatus,
  payload: MidtransStatusPayload,
) {
  const bookingStatusUpdate: BookingStatus | null =
    nextStatus === "PAID"
      ? "CONFIRMED"
      : nextStatus === "FAILED" || nextStatus === "EXPIRED"
        ? "CANCELLED"
        : null;

  const operations = [
    prisma.transaction.update({
      where: { id: transactionId },
      data: {
        paymentStatus: nextStatus,
        ...(nextStatus === "PAID" ? { paidAt: new Date() } : {}),
        paymentMethod: payload.payment_type,
        midtransTransactionId: payload.transaction_id,
      },
    }),
    ...(bookingStatusUpdate
      ? [
          prisma.transactionHomestay.updateMany({
            where: { transactionId },
            data: { bookingStatus: bookingStatusUpdate },
          }),
          prisma.transactionVenue.updateMany({
            where: { transactionId },
            data: { bookingStatus: bookingStatusUpdate },
          }),
          prisma.transactionEdutrip.updateMany({
            where: { transactionId },
            data: { bookingStatus: bookingStatusUpdate },
          }),
        ]
      : []),
  ];

  await prisma.$transaction(operations);
}

/**
 * Fallback reconciliation via Midtrans's Get Status API (section 11/12) -
 * called whenever we can't just trust that the webhook has already run:
 * the customer landing on /booking/success, or an admin syncing a stuck
 * row. A no-op (network-cheap) if the transaction is already in a terminal
 * state locally, since there's nothing left to reconcile.
 */
export async function reconcileFromMidtransGetStatus(
  orderId: string,
): Promise<ReconciliationResult> {
  const transaction = await prisma.transaction.findUnique({
    where: { invoiceNumber: orderId },
  });
  if (!transaction) return { ok: false, reason: "NOT_FOUND" };

  if (transaction.paymentStatus !== "PENDING") {
    // Nothing to reconcile - PAID/FAILED/EXPIRED/REFUNDED are all terminal
    // in this app's model (a real refund still starts from PAID, and is
    // itself reported by Midtrans while the local row is PAID, not PENDING).
    return { ok: true, status: transaction.paymentStatus, changed: false };
  }

  let statusResult;
  try {
    statusResult = await getTransactionStatus(orderId);
  } catch (error) {
    console.error("[Midtrans] Get Status API call failed", {
      orderId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    // Can't reconcile right now - report the current (still PENDING) state
    // rather than failing the caller (e.g. the success page should still
    // render, just showing "waiting").
    return { ok: true, status: transaction.paymentStatus, changed: false };
  }

  return reconcileTransactionStatus(
    orderId,
    {
      transaction_status: statusResult.transaction_status,
      fraud_status: statusResult.fraud_status,
      gross_amount: statusResult.gross_amount,
      payment_type: statusResult.payment_type,
      transaction_id: statusResult.transaction_id,
    },
    "get-status",
  );
}
