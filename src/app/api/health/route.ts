import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Liveness probe for the container/Caddy/uptime monitor. Deliberately does not
 * touch the database or any external service: a Neon outage should not make
 * the orchestrator restart an otherwise healthy app process.
 */
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      commit: process.env.APP_COMMIT || null,
      uptime: Math.round(process.uptime()),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
