"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { reconcileFromMidtransGetStatus } from "@/features/booking/paymentReconciliation";
import {
  requestAutomaticLatePaymentRefund,
  requestRefund,
} from "@/features/payments/refundService";
import { prisma } from "@/lib/prisma";

/**
 * The admin's "Sync" action on a stuck PENDING row (section 15) - this is
 * NOT a manual payment confirmation. It triggers the exact same Get Status
 * API reconciliation /booking/success uses; the admin cannot force a
 * status, only ask the backend to check Midtrans again.
 */
export async function syncPaymentStatus(
  invoiceNumber: string,
): Promise<{ error?: string; status?: string }> {
  await requireAdmin();

  const result = await reconcileFromMidtransGetStatus(invoiceNumber);
  revalidatePath("/admin/payments");

  if (!result.ok) {
    return {
      error:
        result.reason === "AMOUNT_MISMATCH"
          ? "Amount mismatch detected between this booking and Midtrans - check server logs."
          : "Transaction not found.",
    };
  }

  return { status: result.status };
}

/**
 * The admin-initiated refund (sections 8-11) - validates and calls Midtrans
 * server-side via requestRefund; the admin only ever supplies an amount and
 * reason, never a status to force.
 */
export async function refundPayment(input: {
  invoiceNumber: string;
  amount: number;
  reason?: string;
}): Promise<{ error?: string }> {
  const admin = await requireAdmin();

  const result = await requestRefund({
    invoiceNumber: input.invoiceNumber,
    amount: input.amount,
    reason: input.reason,
    admin: { id: admin.id, name: admin.name ?? admin.email ?? "Admin" },
  });

  revalidatePath("/admin/payments");
  return result;
}

/**
 * Retry the deterministic automatic refund for a late payment. Reusing
 * `LATE-<transactionId>` makes this safe even if Midtrans already accepted
 * an earlier attempt. Kept separate from the normal refund modal so an admin
 * cannot accidentally start a second, differently-keyed full refund.
 */
export async function retryLatePaymentRefund(
  invoiceNumber: string,
): Promise<{ error?: string }> {
  await requireAdmin();

  const transaction = await prisma.transaction.findUnique({
    where: { invoiceNumber },
    select: { id: true, latePaymentAt: true, paymentStatus: true },
  });

  if (!transaction || !transaction.latePaymentAt) {
    return { error: "This transaction is not marked as a late payment." };
  }
  if (transaction.paymentStatus !== "PAID" && transaction.paymentStatus !== "PARTIALLY_REFUNDED") {
    return { error: "There is no refundable late payment on this transaction." };
  }

  const result = await requestAutomaticLatePaymentRefund(transaction.id);
  revalidatePath("/admin/payments");
  return result;
}
