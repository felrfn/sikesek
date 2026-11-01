import { NextResponse } from "next/server";
import { sendBookingReminders } from "@/features/bookings/reminderService";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Scheduled facility-booking reminder entry point. Configure the scheduler
 * (Vercel Cron, a platform cron job, GitHub Actions, etc.) to call this every
 * minute with:
 *
 *   Authorization: Bearer <CRON_SECRET>
 *
 * It is intentionally fail-closed when CRON_SECRET is unset, matching
 * /api/cron/payments. The service itself deduplicates per booking/event, so a
 * late or overlapping run never sends the same reminder twice. See
 * docs/BOOKING_REMINDERS.md.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await sendBookingReminders();
  return NextResponse.json({ ok: true, ...summary });
}
