import { prisma } from "@/lib/prisma";
import {
  broadcastToUsers,
  getActiveFieldOfficerIds,
} from "@/features/notifications/pushService";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import type { DetectionIngestInput } from "@/lib/validation/ktr";

/**
 * Distinguishes the two business-level rejection reasons the ingest route
 * maps to different HTTP statuses (404 vs 409) - an unknown area is a
 * configuration mistake, an inactive area is a deliberate operational
 * decision to stop monitoring it.
 */
export class DetectionIngestError extends Error {
  constructor(
    public readonly code: "UNKNOWN_AREA" | "AREA_INACTIVE",
    message: string,
  ) {
    super(message);
    this.name = "DetectionIngestError";
  }
}

/**
 * Claim/resolve workflow failures. Kept separate from `DetectionIngestError`
 * because these are human/mobile actions, not AI ingest contract errors.
 */
export class DetectionWorkflowError extends Error {
  constructor(
    public readonly code: "NOT_FOUND" | "CASE_CLOSED" | "ALREADY_CLAIMED",
    message: string,
    public readonly details?: { handledBy?: string },
  ) {
    super(message);
    this.name = "DetectionWorkflowError";
  }
}

const OPEN_STATUSES = [
  "DETECTED",
  "NOTIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
] as const;

const CLOSED_STATUSES = new Set<string>([
  "RESOLVED",
  "FALSE_POSITIVE",
  "DISMISSED",
]);

/**
 * Records a YOLOv8 smoking detection (FR-08/FR-09) and notifies every active
 * field officer (FR-10). The frontend/backend never generates or modifies
 * this evidence itself (PATTERNS.md ยง13) - it only records what the
 * fog-server reports and already stored (R2 or an external provider).
 *
 * Push is best-effort: Notification rows are written first, FCM failures are
 * logged and swallowed by `broadcastToUsers`, and the detection still moves
 * to NOTIFIED so the mobile polling fallback remains truthful.
 */
export async function ingestDetection(input: DetectionIngestInput) {
  const area = await prisma.monitoredArea.findUnique({
    where: { id: input.areaId },
  });
  if (!area) {
    throw new DetectionIngestError("UNKNOWN_AREA", "Unknown monitored area.");
  }
  if (!area.isActive) {
    throw new DetectionIngestError(
      "AREA_INACTIVE",
      "This monitored area is inactive and no longer accepts detections.",
    );
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

  const officerIds = await getActiveFieldOfficerIds();
  const title = "Pelanggaran KTR terdeteksi";
  const body = `Lokasi: ${area.name} | Waktu: ${formatTime(detection.detectedAt)}, ${formatShortDate(detection.detectedAt)} | Keyakinan: ${(Number(detection.confidence) * 100).toFixed(0)}%`;

  await broadcastToUsers({
    userIds: officerIds,
    detectionId: detection.id,
    title,
    body,
    data: {
      type: "KTR_VIOLATION_NEW",
      violationId: detection.id,
      areaId: area.id,
      confidence: Number(detection.confidence).toString(),
      detectedAt: detection.detectedAt.toISOString(),
    },
  });

  await prisma.smokingDetection.update({
    where: { id: detection.id },
    data: { status: "NOTIFIED" },
  });

  return detection;
}

/**
 * A field officer explicitly takes a case ("Ambil Tindakan" in the mobile
 * app). This is a soft claim, not a hard lock: it tells every other officer
 * who is currently handling the case so two people do not unknowingly work
 * on it, but another officer may still resolve it (assignment, handling and
 * resolution are deliberately distinct - see the User/schema comments).
 *
 * The update is conditional so two simultaneous claims cannot both succeed.
 */
export async function claimDetection(detectionId: string, officerId: string) {
  const officer = await prisma.user.findUnique({
    where: { id: officerId },
    select: { id: true, name: true },
  });
  if (!officer) {
    throw new DetectionWorkflowError("NOT_FOUND", "Officer not found.");
  }

  const detection = await prisma.smokingDetection.findUnique({
    where: { id: detectionId },
    include: {
      area: { select: { id: true, name: true } },
      handlingByUser: { select: { id: true, name: true } },
    },
  });
  if (!detection) {
    throw new DetectionWorkflowError("NOT_FOUND", "Detection not found.");
  }
  if (CLOSED_STATUSES.has(detection.status)) {
    throw new DetectionWorkflowError(
      "CASE_CLOSED",
      "This case is already closed and can no longer be claimed.",
    );
  }
  if (detection.handlingById === officerId) {
    return { detection, alreadyClaimed: true };
  }
  if (detection.handlingById) {
    const handler = await prisma.user.findUnique({
      where: { id: detection.handlingById },
      select: { name: true },
    });
    throw new DetectionWorkflowError(
      "ALREADY_CLAIMED",
      `${handler?.name ?? "Another officer"} is already handling this case.`,
      { handledBy: handler?.name ?? "Another officer" },
    );
  }

  const claimedAt = new Date();
  const update = await prisma.smokingDetection.updateMany({
    where: {
      id: detectionId,
      status: { in: [...OPEN_STATUSES] },
      OR: [{ handlingById: null }, { handlingById: officerId }],
    },
    data: {
      handlingById: officerId,
      handlingStartedAt: claimedAt,
      status: "IN_PROGRESS",
    },
  });

  if (update.count === 0) {
    // Another officer claimed it between our read and write (or the case was
    // closed in the meantime). Re-read to return the useful reason.
    const current = await prisma.smokingDetection.findUnique({
      where: { id: detectionId },
      include: {
        area: { select: { id: true, name: true } },
        handlingByUser: { select: { id: true, name: true } },
      },
    });
    if (!current) {
      throw new DetectionWorkflowError("NOT_FOUND", "Detection not found.");
    }
    if (CLOSED_STATUSES.has(current.status)) {
      throw new DetectionWorkflowError(
        "CASE_CLOSED",
        "This case is already closed and can no longer be claimed.",
      );
    }
    if (current.handlingById && current.handlingById !== officerId) {
      const handler = await prisma.user.findUnique({
        where: { id: current.handlingById },
        select: { name: true },
      });
      throw new DetectionWorkflowError(
        "ALREADY_CLAIMED",
        `${handler?.name ?? "Another officer"} is already handling this case.`,
        { handledBy: handler?.name ?? "Another officer" },
      );
    }
    throw new DetectionWorkflowError(
      "ALREADY_CLAIMED",
      "This case is already being handled.",
    );
  }

  // Starting an assigned task also moves that officer's own assignment to
  // IN_PROGRESS. Other officers' assignments are untouched.
  await prisma.ktrAssignment.updateMany({
    where: {
      detectionId,
      assignedToId: officerId,
      status: "ASSIGNED",
    },
    data: { status: "IN_PROGRESS", acceptedAt: claimedAt },
  });

  const claimed = await prisma.smokingDetection.findUnique({
    where: { id: detectionId },
    include: {
      area: { select: { id: true, name: true } },
      handlingByUser: { select: { id: true, name: true } },
    },
  });
  if (!claimed) {
    throw new DetectionWorkflowError("NOT_FOUND", "Detection not found.");
  }

  const officerIds = await getActiveFieldOfficerIds();
  const title = "Kasus KTR sedang ditangani";
  const body = `${officer.name} sedang menangani pelanggaran di ${claimed.area.name} | Waktu: ${formatTime(claimedAt)}, ${formatShortDate(claimedAt)}`;

  await broadcastToUsers({
    userIds: officerIds.filter((id) => id !== officerId),
    detectionId,
    title,
    body,
    data: {
      type: "KTR_VIOLATION_CLAIMED",
      violationId: detectionId,
      handledBy: officer.name,
      handledAt: claimedAt.toISOString(),
    },
  });

  return { detection: claimed, alreadyClaimed: false };
}

/**
 * Single resolve path shared by the admin dashboard and the mobile endpoint.
 * The update is conditional, so concurrent/duplicate resolve attempts cannot
 * produce duplicate RESOLVED broadcasts. Assignment/handling/resolution stay
 * distinct: an officer who was assigned to the case may not be the one who
 * actually resolves it.
 */
export async function resolveDetectionForUser(input: {
  detectionId: string;
  resolver: { id: string; name: string };
  notes?: string;
}) {
  const detection = await prisma.smokingDetection.findUnique({
    where: { id: input.detectionId },
    include: {
      area: { select: { id: true, name: true } },
      resolvedByUser: { select: { id: true, name: true } },
    },
  });
  if (!detection) {
    throw new DetectionWorkflowError("NOT_FOUND", "Detection not found.");
  }
  if (detection.status === "RESOLVED") {
    return { detection, alreadyResolved: true };
  }
  if (CLOSED_STATUSES.has(detection.status)) {
    throw new DetectionWorkflowError(
      "CASE_CLOSED",
      "This case is already closed and can no longer be resolved.",
    );
  }

  const resolvedAt = new Date();
  const update = await prisma.smokingDetection.updateMany({
    where: {
      id: input.detectionId,
      status: { in: [...OPEN_STATUSES] },
    },
    data: {
      status: "RESOLVED",
      resolvedBy: input.resolver.id,
      resolvedAt,
      notes: input.notes?.trim() || undefined,
    },
  });

  if (update.count === 0) {
    const current = await prisma.smokingDetection.findUnique({
      where: { id: input.detectionId },
      include: {
        area: { select: { id: true, name: true } },
        resolvedByUser: { select: { id: true, name: true } },
      },
    });
    if (!current) {
      throw new DetectionWorkflowError("NOT_FOUND", "Detection not found.");
    }
    if (current.status === "RESOLVED") {
      return { detection: current, alreadyResolved: true };
    }
    throw new DetectionWorkflowError(
      "CASE_CLOSED",
      "This case is already closed and can no longer be resolved.",
    );
  }

  // A resolved case is no longer actionable: the resolver's own assignment
  // is completed, while everyone else's open assignment is cancelled so it
  // does not linger in their task list.
  await prisma.ktrAssignment.updateMany({
    where: {
      detectionId: input.detectionId,
      assignedToId: input.resolver.id,
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
    },
    data: { status: "COMPLETED", completedAt: resolvedAt },
  });
  await prisma.ktrAssignment.updateMany({
    where: {
      detectionId: input.detectionId,
      assignedToId: { not: input.resolver.id },
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
    },
    data: { status: "CANCELLED" },
  });

  const resolved = await prisma.smokingDetection.findUnique({
    where: { id: input.detectionId },
    include: {
      area: { select: { id: true, name: true } },
      resolvedByUser: { select: { id: true, name: true } },
    },
  });
  if (!resolved) {
    throw new DetectionWorkflowError("NOT_FOUND", "Detection not found.");
  }

  // Per the agreed contract, every active field officer hears about the
  // resolution - including the resolver, who gets a confirmation.
  const officerIds = await getActiveFieldOfficerIds();
  const title = "Pelanggaran KTR selesai";
  const body = `${input.resolver.name} telah menyelesaikan pelanggaran di ${resolved.area.name} | Waktu: ${formatTime(resolvedAt)}, ${formatShortDate(resolvedAt)}`;

  await broadcastToUsers({
    userIds: officerIds,
    detectionId: input.detectionId,
    title,
    body,
    data: {
      type: "KTR_VIOLATION_RESOLVED",
      violationId: input.detectionId,
      resolvedBy: input.resolver.name,
      resolvedAt: resolvedAt.toISOString(),
    },
  });

  return { detection: resolved, alreadyResolved: false };
}
