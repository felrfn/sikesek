"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import {
  deleteDetection,
  reopenDetection,
  resolveDetection,
  updateDetection,
} from "@/features/violations/actions";
import { EvidenceImage } from "./EvidenceImage";
import type { MonitoredArea } from "@prisma/client";

interface DetectionForPanel {
  id: string;
  areaId: string;
  area: MonitoredArea;
  confidence: number;
  evidenceKey: string;
  source: "API" | "MANUAL";
  status: "DETECTED" | "NOTIFIED" | "RESOLVED";
  detectedAt: string;
  resolvedAt: string | null;
  notes: string | null;
}

const statusTone = {
  DETECTED: "danger",
  NOTIFIED: "warning",
  RESOLVED: "success",
} as const;

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
        className="h-48 w-full rounded-lg object-cover"
      />

      {mode === "view" ? (
        <>
          <dl className="space-y-2 text-sm">
            <Row label="Status">
              <Badge tone={statusTone[detection.status]}>{detection.status}</Badge>
            </Row>
            <Row label="Confidence">{(detection.confidence * 100).toFixed(0)}%</Row>
            <Row label="Detected at">
              {formatShortDate(detection.detectedAt)} {formatTime(detection.detectedAt)}
            </Row>
            {detection.resolvedAt ? (
              <Row label="Resolved at">
                {formatShortDate(detection.resolvedAt)} {formatTime(detection.resolvedAt)}
              </Row>
            ) : null}
            <Row label="Notes">{detection.notes ?? "-"}</Row>
          </dl>

          <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
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
