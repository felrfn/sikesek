import { NextResponse } from "next/server";
import { expirePendingPayments } from "@/features/payments/expiryService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled payment-expiry entry point. Configure your scheduler (Vercel
 * Cron, a platform cron job, GitHub Actions, etc.) to call this every
 * minute with:
 *
 *   Authorization: Bearer <CRON_SECRET>
 *
 * It is intentionally fail-closed when CRON_SECRET is unset, so a public
 * deployment cannot be made to expire arbitrary invoices by guessing the
 * URL. See docs/PAYMENT.md.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await expirePendingPayments();
  return NextResponse.json({ ok: true, ...summary });
}
