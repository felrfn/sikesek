import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import { getSignedPrivateUrl, StorageNotConfiguredError } from "@/lib/storage/r2";

/** Recent KTR detections for the mobile field-officer app (FR-11). */
export async function GET(request: Request) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const detections = await prisma.smokingDetection.findMany({
    include: { area: true },
    orderBy: { detectedAt: "desc" },
    take: 50,
  });

  const items = await Promise.all(
    detections.map(async (d) => {
      let evidenceUrl: string | null = null;
      try {
        evidenceUrl = await getSignedPrivateUrl(d.evidenceKey);
      } catch (error) {
        if (!(error instanceof StorageNotConfiguredError)) throw error;
      }

      return {
        id: d.id,
        areaId: d.areaId,
        areaName: d.area.name,
        confidence: Number(d.confidence),
        status: d.status,
        evidenceUrl,
        detectedAt: d.detectedAt.toISOString(),
        resolvedAt: d.resolvedAt?.toISOString() ?? null,
        notes: d.notes,
      };
    }),
  );

  return NextResponse.json({ items });
}
