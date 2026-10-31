import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isValidKtrApiKey } from "@/lib/auth/ktrApiKey";
import {
  getSignedPrivateUploadUrl,
  StorageNotConfiguredError,
} from "@/lib/storage/r2";

const EVIDENCE_CONTENT_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

const evidenceUploadSchema = z.object({
  areaId: z.string().uuid(),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

function error(code: string, message: string, status: number, details?: unknown) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status },
  );
}

/**
 * Issues a short-lived presigned PUT URL so the fog-server can upload one
 * evidence image straight to the private R2 prefix without ever holding our
 * R2 credentials.
 *
 * The caller then PUTs the file bytes to `uploadUrl` with the same
 * `Content-Type` it requested here, and passes the returned `key` as
 * `evidenceKey` to POST /api/ktr/detect.
 *
 * Contract: docs/KTR_INGEST.md.
 */
export async function POST(request: Request) {
  if (!isValidKtrApiKey(request.headers.get("x-api-key"))) {
    return error("UNAUTHORIZED", "Invalid or missing API key.", 401);
  }

  const parsed = evidenceUploadSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return error(
      "VALIDATION_ERROR",
      "Invalid evidence upload payload.",
      400,
      parsed.error.flatten(),
    );
  }

  let area: { id: string; isActive: boolean } | null;
  try {
    area = await prisma.monitoredArea.findUnique({
      where: { id: parsed.data.areaId },
      select: { id: true, isActive: true },
    });
  } catch (caught) {
    console.error("Failed to look up monitored area", caught);
    return error("INTERNAL_ERROR", "Could not look up the monitored area.", 500);
  }

  if (!area) {
    return error("UNKNOWN_AREA", "Unknown monitored area.", 404);
  }
  if (!area.isActive) {
    return error(
      "AREA_INACTIVE",
      "This monitored area is inactive and no longer accepts evidence.",
      409,
    );
  }

  const extension = EVIDENCE_CONTENT_TYPES[parsed.data.contentType];
  const objectKey = `ktr/evidence/${area.id}/${randomUUID()}.${extension}`;

  try {
    const signed = await getSignedPrivateUploadUrl(
      objectKey,
      parsed.data.contentType,
    );
    return NextResponse.json(signed);
  } catch (caught) {
    if (caught instanceof StorageNotConfiguredError) {
      return error(
        "STORAGE_NOT_CONFIGURED",
        "Object storage is not configured in this environment.",
        503,
      );
    }

    console.error("Failed to sign KTR evidence upload URL", caught);
    return error(
      "INTERNAL_ERROR",
      "Could not create an evidence upload URL.",
      500,
    );
  }
}
