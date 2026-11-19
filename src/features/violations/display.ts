import type { DetectionStatus } from "@prisma/client";

type BadgeTone = "success" | "warning" | "danger" | "neutral" | "info";

/**
 * Shared KTR status metadata for both server components (URL filter parsing)
 * and client components (filter popover, table, detail panel). This module has
 * no "use client" directive on purpose: importing a plain array/object from a
 * client module into a Server Component yields a client-reference proxy, not
 * the actual value (that is what broke `DETECTION_STATUS_OPTIONS.includes`).
 */
export const DETECTION_STATUS_OPTIONS: DetectionStatus[] = [
  "DETECTED",
  "NOTIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "FALSE_POSITIVE",
  "DISMISSED",
];

export const DETECTION_STATUS_META: Record<
  DetectionStatus,
  { label: string; tone: BadgeTone }
> = {
  DETECTED: { label: "Detected", tone: "danger" },
  NOTIFIED: { label: "Notified", tone: "warning" },
  ASSIGNED: { label: "Assigned", tone: "info" },
  IN_PROGRESS: { label: "In Progress", tone: "warning" },
  RESOLVED: { label: "Resolved", tone: "success" },
  FALSE_POSITIVE: { label: "False Positive", tone: "neutral" },
  DISMISSED: { label: "Dismissed", tone: "neutral" },
};

const CLOSED_STATUSES = new Set<DetectionStatus>([
  "RESOLVED",
  "FALSE_POSITIVE",
  "DISMISSED",
]);

/** `IN_PROGRESS` -> `In Progress`, for statuses outside the detection enum. */
export function humanizeStatus(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function detectionStatusLabel(status: string) {
  return DETECTION_STATUS_META[status as DetectionStatus]?.label ?? humanizeStatus(status);
}

export function detectionStatusTone(status: string): BadgeTone {
  return DETECTION_STATUS_META[status as DetectionStatus]?.tone ?? "neutral";
}

export function isClosedDetectionStatus(status: string) {
  return CLOSED_STATUSES.has(status as DetectionStatus);
}
