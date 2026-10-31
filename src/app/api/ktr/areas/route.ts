import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isValidKtrApiKey } from "@/lib/auth/ktrApiKey";

/**
 * Machine-to-machine area registry for the YOLOv8 fog-server: it pulls the
 * areaId/streamUrl mapping from here instead of having UUIDs hardcoded or
 * sent over chat. Only active areas are returned - an area an admin has
 * deactivated stops appearing here and rejects detections (409).
 *
 * Auth: `x-api-key: $KTR_INGEST_API_KEY`, same as POST /api/ktr/detect.
 * Contract: docs/KTR_INGEST.md.
 */
export async function GET(request: Request) {
  if (!isValidKtrApiKey(request.headers.get("x-api-key"))) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Invalid or missing API key.",
        },
      },
      { status: 401 },
    );
  }

  try {
    const areas = await prisma.monitoredArea.findMany({
      where: { isActive: true },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        locationDescription: true,
        streamUrl: true,
        assignedEmployee: { select: { id: true, name: true } },
      },
    });

    return NextResponse.json({ areas });
  } catch (caught) {
    console.error("Failed to list monitored areas", caught);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Could not list monitored areas.",
        },
      },
      { status: 500 },
    );
  }
}
