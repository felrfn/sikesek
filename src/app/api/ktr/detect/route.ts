import { NextResponse } from "next/server";
import { detectionIngestSchema } from "@/lib/validation/ktr";
import {
  DetectionIngestError,
  ingestDetection,
} from "@/features/violations/service";
import { isValidKtrApiKey } from "@/lib/auth/ktrApiKey";

function error(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

/**
 * Called by the YOLOv8 fog-server component (out of scope for this Next.js
 * app - see RULES.md's "web only" scope note), not by browsers, so it is
 * authenticated with a shared API key rather than a user session.
 *
 * Full contract (including how to fetch area ids and upload evidence):
 * docs/KTR_INGEST.md.
 */
export async function POST(request: Request) {
  if (!isValidKtrApiKey(request.headers.get("x-api-key"))) {
    return error("UNAUTHORIZED", "Invalid or missing API key.", 401);
  }

  const parsed = detectionIngestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return error(
      "VALIDATION_ERROR",
      "Invalid detection payload.",
      400,
      parsed.error.flatten(),
    );
  }

  try {
    const detection = await ingestDetection(parsed.data);
    return NextResponse.json({ id: detection.id }, { status: 201 });
  } catch (caught) {
    if (caught instanceof DetectionIngestError) {
      return error(
        caught.code,
        caught.message,
        caught.code === "AREA_INACTIVE" ? 409 : 404,
      );
    }

    console.error("Failed to ingest KTR detection", caught);
    return error("INTERNAL_ERROR", "Could not record the detection.", 500);
  }
}
