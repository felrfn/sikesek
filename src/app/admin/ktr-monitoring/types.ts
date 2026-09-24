import type { DetectionSource, DetectionStatus, MonitoredArea } from "@prisma/client";

export interface AssignmentForPanel {
  id: string;
  status: "ASSIGNED" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";
  assignedTo: { id: string; name: string };
}

/**
 * The shape KtrTable/KtrClient/DetectionPanel share, after the server
 * component has serialized `confidence` (Decimal) and the date fields
 * (Date -> ISO string) for RSC/client-component transport.
 */
export interface DetectionForPanel {
  id: string;
  areaId: string;
  area: MonitoredArea;
  confidence: number;
  evidenceKey: string;
  source: DetectionSource;
  status: DetectionStatus;
  detectedAt: string;
  resolvedAt: string | null;
  resolvedByUser: { id: string; name: string } | null;
  notes: string | null;
  assignments: AssignmentForPanel[];
}
