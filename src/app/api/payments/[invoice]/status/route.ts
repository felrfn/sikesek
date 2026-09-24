import { NextResponse } from "next/server";
import { getTransactionByInvoice } from "@/features/booking/service";
import { reconcileFromMidtransGetStatus } from "@/features/booking/paymentReconciliation";

/**
 * Section 12's reconciliation endpoint: reads the canonical payment status,
 * actively reconciling against Midtrans's Get Status API first if the
 * local record is still PENDING (the fallback for a webhook that hasn't
 * arrived yet - see the webhook route's doc comment on why that happens
 * routinely in local development). Used by /booking/success and the admin
 * payments page's per-row "Sync" action; not a mobile-facing endpoint.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoice: string }> },
) {
  const { invoice } = await params;

  const existing = await getTransactionByInvoice(invoice);
  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (existing.paymentStatus === "PENDING") {
    const result = await reconcileFromMidtransGetStatus(invoice);
    if (!result.ok) {
      // Reconciliation couldn't complete (amount mismatch, etc.) - still
      // report the last-known-good local status rather than erroring the
      // whole request; the discrepancy is already logged server-side.
      return NextResponse.json({ paymentStatus: existing.paymentStatus, reconciled: false });
    }
    return NextResponse.json({ paymentStatus: result.status, reconciled: result.changed });
  }

  return NextResponse.json({ paymentStatus: existing.paymentStatus, reconciled: false });
}
