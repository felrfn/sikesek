import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireMobileAuth } from "@/lib/auth/requireMobileAuth";
import { resolveEvidenceUrl, StorageNotConfiguredError } from "@/lib/storage/objectStorage";

/** Recent KTR detections for the mobile field-officer app (FR-11). */
export async function GET(request: Request) {
  const auth = await requireMobileAuth(request);
  if (!auth.ok) return auth.response;

  const detections = await prisma.smokingDetection.findMany({
    include: {
      area: true,
      handlingByUser: { select: { id: true, name: true } },
      resolvedByUser: { select: { id: true, name: true } },
    },
    orderBy: { detectedAt: "desc" },
    take: 50,
  });

  const items = await Promise.all(
    detections.map(async (d) => {
      let evidenceUrl: string | null = null;
      try {
        evidenceUrl = await resolveEvidenceUrl(d.evidenceKey);
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
        handlingBy: d.handlingByUser?.name ?? null,
        handlingStartedAt: d.handlingStartedAt?.toISOString() ?? null,
        detectedAt: d.detectedAt.toISOString(),
        resolvedBy: d.resolvedByUser?.name ?? null,
        resolvedAt: d.resolvedAt?.toISOString() ?? null,
        notes: d.notes,
      };
    }),
  );

  return NextResponse.json({ items });
}
