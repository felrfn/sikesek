"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { reconcileFromMidtransGetStatus } from "@/features/booking/paymentReconciliation";

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
