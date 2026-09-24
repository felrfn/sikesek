import { prisma } from "@/lib/prisma";
import { sendPushToTokens } from "@/lib/fcm";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import type { DetectionIngestInput } from "@/lib/validation/ktr";

/**
 * Records a YOLOv8 smoking detection (FR-08/FR-09) and notifies active
 * field officers (FR-10). The frontend/backend never generates or modifies
 * this evidence itself (PATTERNS.md ยง13) - it only records what the
 * fog-server reports and already stored in Cloudflare R2.
 */
export async function ingestDetection(input: DetectionIngestInput) {
  const area = await prisma.monitoredArea.findUnique({
    where: { id: input.areaId },
  });
  if (!area) {
    throw new Error("Unknown monitored area");
  }

  const detection = await prisma.smokingDetection.create({
    data: {
      areaId: input.areaId,
      confidence: input.confidence,
      evidenceKey: input.evidenceKey,
      detectedAt: input.detectedAt ? new Date(input.detectedAt) : new Date(),
      status: "DETECTED",
      source: "API",
    },
  });

  const fieldOfficers = await prisma.user.findMany({
    where: { role: "FIELD_OFFICER", deletedAt: null },
    include: { fcmTokens: true },
  });

  const title = "KTR violation detected";
  const body = `Location: ${area.name} | Time: ${formatTime(detection.detectedAt)} on ${formatShortDate(detection.detectedAt)} | Confidence: ${(Number(detection.confidence) * 100).toFixed(0)}%`;

  await prisma.notification.createMany({
    data: fieldOfficers.map((officer) => ({
      detectionId: detection.id,
      recipientId: officer.id,
      title,
      body,
    })),
  });

  const tokens = fieldOfficers.flatMap((officer) =>
    officer.fcmTokens.map((t) => t.token),
  );
  await sendPushToTokens(tokens, { title, body });

  await prisma.smokingDetection.update({
    where: { id: detection.id },
    data: { status: "NOTIFIED" },
  });

  return detection;
}
