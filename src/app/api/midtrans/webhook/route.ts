import { NextResponse } from "next/server";
import { verifyMidtransSignature } from "@/lib/midtrans";
import { reconcileTransactionStatus } from "@/features/booking/paymentReconciliation";

interface MidtransNotification {
  order_id: string;
  status_code: string;
  gross_amount: string;
  signature_key: string;
  transaction_status: string;
  fraud_status?: string;
  payment_type?: string;
  transaction_id?: string;
}

/**
 * Midtrans HTTP Notification endpoint
 * (https://docs.midtrans.com/docs/https-notification-webhooks). This must
 * be reachable over public HTTPS for Midtrans to call it - a bare
 * `http://localhost:3000` notification URL will never be hit, which is why
 * /booking/success and the admin payments page also reconcile via the Get
 * Status API fallback (features/booking/paymentReconciliation.ts) rather
 * than depending on this webhook alone. For local development, either
 * expose this route through an HTTPS tunnel (e.g. `ngrok http 3000` or
 * `cloudflared tunnel --url http://localhost:3000`) and set that tunnel's
 * URL as the sandbox "Payment Notification URL" in the Midtrans Dashboard,
 * or just rely on the Get Status fallback - the booking flow works either
 * way, only the "the webhook itself fires" scenario needs the tunnel.
 */
export async function POST(request: Request) {
  let body: MidtransNotification;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const isValid = verifyMidtransSignature({
    orderId: body.order_id,
    statusCode: body.status_code,
    grossAmount: body.gross_amount,
    signatureKey: body.signature_key,
  });

  if (!isValid) {
    console.error("[Payment] Invalid Midtrans notification signature", {
      orderId: body.order_id,
    });
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  const result = await reconcileTransactionStatus(body.order_id, body, "webhook");

  if (!result.ok && result.reason === "NOT_FOUND") {
    // Midtrans retries on non-2xx, and a transaction that genuinely
    // doesn't exist never will - acknowledge so it stops retrying.
    return NextResponse.json({ ok: true, note: "transaction not found" });
  }
  if (!result.ok && result.reason === "AMOUNT_MISMATCH") {
    // Deliberately still 200: this is a data-integrity problem to
    // investigate (already logged), not something retrying will fix.
    return NextResponse.json({ ok: true, note: "amount mismatch, flagged" });
  }

  return NextResponse.json({ ok: true });
}
