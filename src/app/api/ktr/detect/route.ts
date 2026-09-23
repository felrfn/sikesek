import { NextResponse } from "next/server";
import { detectionIngestSchema } from "@/lib/validation/ktr";
import { ingestDetection } from "@/features/violations/service";

/**
 * Called by the YOLOv8 fog-server component (out of scope for this Next.js
 * app - see RULES.md's "web only" scope note), not by browsers, so it is
 * authenticated with a shared API key rather than a user session.
 */
export async function POST(request: Request) {
  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.KTR_INGEST_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = detectionIngestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid detection payload", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const detection = await ingestDetection(parsed.data);
    return NextResponse.json({ id: detection.id }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
