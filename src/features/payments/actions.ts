"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { reconcileFromMidtransGetStatus } from "@/features/booking/paymentReconciliation";
import { requestRefund } from "@/features/payments/refundService";

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
