"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import {
  deleteDetection,
  dismissDetection,
  markFalsePositive,
  reopenDetection,
  resolveDetection,
  updateDetection,
} from "@/features/violations/actions";
import { cancelKtrAssignment } from "@/features/ktrAssignments/actions";
import { EvidenceImage } from "./EvidenceImage";
import { AssignWorkersModal } from "./AssignWorkersModal";
import type { MonitoredArea } from "@prisma/client";
import type { DetectionForPanel } from "./types";

const statusTone = {
  DETECTED: "danger",
  NOTIFIED: "warning",
  ASSIGNED: "info",
  IN_PROGRESS: "warning",
  RESOLVED: "success",
  FALSE_POSITIVE: "neutral",
  DISMISSED: "neutral",
} as const;

const CLOSED_STATUSES = new Set(["RESOLVED", "FALSE_POSITIVE", "DISMISSED"]);

export function DetectionPanel({
  detection,
  areas,
  onClose,
}: {
  detection: DetectionForPanel;
  areas: MonitoredArea[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit">("view");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const result = await updateDetection(detection.id, new FormData(event.currentTarget));
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setMode("view");
    router.refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this KTR record? This cannot be undone.")) return;
    await deleteDetection(detection.id);
    onClose();
    router.refresh();
  }

  const closed = CLOSED_STATUSES.has(detection.status);

  return (
    <Card className="flex h-fit flex-col gap-4 p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase text-gray-400">
            {detection.source === "MANUAL" ? "Manual entry" : "Automated detection"}
          </p>
          <h2 className="font-semibold text-gray-900">{detection.area.name}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-1 text-gray-400 hover:bg-gray-100"
        >
          <X className="size-4" />
        </button>
      </div>

      <EvidenceImage
        evidenceKey={detection.evidenceKey}
        className="h-48 w-full rounded-lg"
      />

      {mode === "view" ? (
        <>
          <dl className="space-y-2 text-sm">
            <Row label="Status">
              <Badge tone={statusTone[detection.status]}>
                {detection.status.replace("_", " ")}
              </Badge>
            </Row>
            <Row label="Confidence">{(detection.confidence * 100).toFixed(0)}%</Row>
            <Row label="Detected at">
              {formatShortDate(detection.detectedAt)} {formatTime(detection.detectedAt)}
            </Row>
            {detection.resolvedAt && detection.resolvedByUser ? (
              <>
                <Row label="Resolved by">{detection.resolvedByUser.name}</Row>
                <Row label="Resolved at">
                  {formatShortDate(detection.resolvedAt)} {formatTime(detection.resolvedAt)}
                </Row>
              </>
            ) : null}
            <Row label="Notes">{detection.notes ?? "-"}</Row>
          </dl>

          {detection.assignments.length > 0 ? (
            <div className="border-t border-gray-100 pt-3">
              <p className="mb-1 text-xs font-medium uppercase text-gray-400">
                Assigned to
              </p>
              <ul className="space-y-1">
                {detection.assignments.map((a) => (
                  <li key={a.id} className="flex items-center justify-between text-sm">
                    <span className="text-gray-700">
                      {a.assignedTo.name}{" "}
                      <span className="text-xs text-gray-400">({a.status})</span>
                    </span>
                    {!closed ? (
                      <button
                        type="button"
                        onClick={async () => {
                          await cancelKtrAssignment(a.id);
                          router.refresh();
                        }}
                        className="text-xs text-gray-400 hover:text-red-600"
                      >
                        Cancel
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
            {!closed ? (
              <Button size="sm" variant="outline" onClick={() => setAssignOpen(true)}>
                <UserPlus className="size-4" />
                Assign Resolution
              </Button>
            ) : null}
            {detection.status !== "RESOLVED" ? (
              <Button
                size="sm"
                onClick={async () => {
                  await resolveDetection(detection.id);
                  router.refresh();
                }}
              >
                Mark resolved
              </Button>
            ) : (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  await reopenDetection(detection.id);
                  router.refresh();
                }}
              >
                Reopen
              </Button>
            )}
            {!closed ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("Mark this as an AI false detection (false positive)?")) return;
                    await markFalsePositive(detection.id);
                    router.refresh();
                  }}
                >
                  False Positive
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    if (!confirm("Dismiss this case?")) return;
                    await dismissDetection(detection.id);
                    router.refresh();
                  }}
                >
                  Dismiss
                </Button>
              </>
            ) : null}
            <Button size="sm" variant="outline" onClick={() => setMode("edit")}>
              Edit
            </Button>
            <Button size="sm" variant="danger" onClick={handleDelete}>
              Delete
            </Button>
          </div>
        </>
      ) : (
        <form onSubmit={handleUpdate} className="space-y-3">
          <label className="block text-sm font-medium text-gray-700">
            Location
            <select
              name="areaId"
              defaultValue={detection.areaId}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              {areas.map((area) => (
                <option key={area.id} value={area.id}>
                  {area.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Confidence (0-1)
            <input
              name="confidence"
              type="number"
              step="0.01"
              min={0}
              max={1}
              defaultValue={detection.confidence}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Notes
            <textarea
              name="notes"
              defaultValue={detection.notes ?? ""}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setMode("view")}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      <AssignWorkersModal
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        detectionId={detection.id}
        onAssigned={() => router.refresh()}
      />
    </Card>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-gray-400">{label}</dt>
      <dd className="text-right text-gray-800">{children}</dd>
    </div>
  );
}
