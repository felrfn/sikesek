"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { KtrTable } from "./KtrTable";
import { DetectionPanel } from "./DetectionPanel";
import { NewDetectionForm } from "./NewDetectionForm";
import type { MonitoredArea } from "@prisma/client";
import type { DetectionForPanel } from "./types";

export function KtrClient({
  detections,
  areas,
}: {
  detections: DetectionForPanel[];
  areas: MonitoredArea[];
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selected = detections.find((d) => d.id === selectedId) ?? null;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div className="lg:col-span-2">
        <div className="mb-3 flex justify-end">
          <Button size="sm" variant="outline" onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Log Incident
          </Button>
        </div>
        <KtrTable
          detections={detections}
          selectedId={selectedId}
          onSelect={(id) => {
            setSelectedId(id);
            setCreating(false);
          }}
        />
      </div>

      <div>
        {creating ? (
          <NewDetectionForm areas={areas} onDone={() => setCreating(false)} />
        ) : selected ? (
          <DetectionPanel
            detection={selected}
            areas={areas}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-gray-300 text-sm text-gray-400">
            Select a record to view details
          </div>
        )}
      </div>
    </div>
  );
}
