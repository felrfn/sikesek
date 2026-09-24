import { Snap } from "midtrans-client";
import crypto from "node:crypto";
import type { PaymentStatus } from "@prisma/client";

function getServerKey() {
  const key = process.env.MIDTRANS_SERVER_KEY;
  if (!key) throw new Error("MIDTRANS_SERVER_KEY is not configured");
  return key;
}

function getSnapClient() {
  return new Snap({
    isProduction: process.env.NODE_ENV === "production",
    serverKey: getServerKey(),
    clientKey: process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY,
  });
}

export interface CreateSnapTransactionInput {
  invoiceNumber: string;
  grossAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  itemDetails: Array<{ id: string; name: string; price: number }>;
}

export async function createSnapTransaction(
  input: CreateSnapTransactionInput,
) {
  const snap = getSnapClient();

  return snap.createTransaction({
    transaction_details: {
      order_id: input.invoiceNumber,
      gross_amount: input.grossAmount,
    },
    customer_details: {
      first_name: input.customerName,
      email: input.customerEmail,
      phone: input.customerPhone,
    },
    item_details: input.itemDetails.map((item) => ({
      id: item.id,
      name: item.name.slice(0, 50),
      price: item.price,
      quantity: 1,
    })),
    callbacks: {
      finish: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/booking/success?invoice=${input.invoiceNumber}`,
    },
  });
}

/**
 * Get Status API (https://docs.midtrans.com/reference/get-transaction-status) -
 * the authoritative source of a transaction's *current* state, used as a
 * fallback whenever we can't just wait for the webhook: the customer
 * landing on /booking/success before the webhook arrives, an admin
 * reconciling a stuck PENDING row, etc. Never exposed to the browser -
 * this calls Midtrans with the server key from the server only.
 */
export async function getTransactionStatus(orderId: string) {
  const snap = getSnapClient();
  return snap.transaction.status(orderId);
}

/**
 * `midtrans-client` throws a `MidtransError` (message + httpStatusCode +
 * ApiResponse, see node_modules/midtrans-client/lib/midtransError.js) but
 * ships no type declarations for it, so this narrows the unknown catch
 * value structurally instead of casting - no `as any`/`as MidtransError`.
 */
export interface MidtransApiError {
  message: string;
  httpStatusCode?: number;
  ApiResponse?: { status_code?: string; status_message?: string; error_messages?: string[] };
}

export function isMidtransApiError(error: unknown): error is MidtransApiError {
  return (
    error instanceof Error &&
    ("httpStatusCode" in error || "ApiResponse" in error)
  );
}

/**
 * The single, centralized mapping from Midtrans's `transaction_status`
 * (+ `fraud_status` for card payments) to our own PaymentStatus - see
 * https://docs.midtrans.com/docs/https-notification-webhooks and
 * https://docs.midtrans.com/reference/handle-notifications. Both the
 * webhook handler and the Get Status API reconciliation path call this -
 * neither reimplements the rule.
 *
 * Returns `null` for a Midtrans status this app doesn't have an opinion on
 * (e.g. `authorize`), meaning "no change" to whoever calls this.
 */
export function mapMidtransStatus(
  transactionStatus: string,
  fraudStatus?: string,
): PaymentStatus | null {
  if (transactionStatus === "settlement") return "PAID";
  if (transactionStatus === "capture") {
    if (fraudStatus === "accept" || !fraudStatus) return "PAID";
    if (fraudStatus === "deny") return "FAILED";
    return null; // e.g. fraud_status "challenge" - awaiting manual fraud review
  }
  if (transactionStatus === "pending") return "PENDING";
  if (transactionStatus === "deny" || transactionStatus === "cancel") return "FAILED";
  if (transactionStatus === "expire") return "EXPIRED";
  if (transactionStatus === "refund" || transactionStatus === "partial_refund") {
    return "REFUNDED";
  }
  return null;
}

/**
 * A payment status's rank in the settlement lifecycle - used to prevent
 * out-of-order Midtrans notifications from downgrading an already-settled
 * payment (section 10: a late `pending` notification must never undo an
 * earlier `settlement`). A transition is only ever applied if it strictly
 * increases rank; same-or-lower is treated as a no-op.
 */
export const PAYMENT_STATUS_RANK: Record<PaymentStatus, number> = {
  PENDING: 0,
  FAILED: 1,
  EXPIRED: 1,
  PAID: 2,
  REFUNDED: 3,
};

export function isForwardTransition(current: PaymentStatus, next: PaymentStatus) {
  return PAYMENT_STATUS_RANK[next] > PAYMENT_STATUS_RANK[current];
}

/**
 * Midtrans notification signature: sha512(order_id + status_code +
 * gross_amount + server_key). See PATTERNS.md ยง12 - payment confirmation
 * must be verified server-side, never trusted from the client.
 */
export function verifyMidtransSignature(input: {
  orderId: string;
  statusCode: string;
  grossAmount: string;
  signatureKey: string;
}) {
  const expected = crypto
    .createHash("sha512")
    .update(
      `${input.orderId}${input.statusCode}${input.grossAmount}${getServerKey()}`,
    )
    .digest("hex");

  return expected === input.signatureKey;
}
