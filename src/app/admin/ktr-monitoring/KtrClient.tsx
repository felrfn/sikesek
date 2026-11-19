"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import type { PaginationMeta } from "@/lib/utils/adminQuery";
import type { DetectionStatus } from "@prisma/client";
import { KtrTable } from "./KtrTable";
import { DetectionPanel } from "./DetectionPanel";
import { NewDetectionForm } from "./NewDetectionForm";
import { KtrFilterPanel } from "./KtrFilterPanel";
import type { MonitoredArea } from "@prisma/client";
import type { DetectionForPanel } from "./types";

export function KtrClient({
  detections,
  areas,
  meta,
  statuses,
  dateActive,
  sortDir,
}: {
  detections: DetectionForPanel[];
  areas: MonitoredArea[];
  meta: PaginationMeta;
  statuses: DetectionStatus[];
  dateActive: boolean;
  sortDir: "asc" | "desc";
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const selected = detections.find((d) => d.id === selectedId) ?? null;
  const drawerOpen = creating || selected !== null;

  function closeDrawer() {
    setSelectedId(null);
    setCreating(false);
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <KtrFilterPanel
          selectedStatuses={statuses}
          dateActive={dateActive}
        />
        <Button
          size="sm"
          onClick={() => {
            setSelectedId(null);
            setCreating(true);
          }}
        >
          <Plus className="size-4" />
          Catat Insiden
        </Button>
      </div>

      <KtrTable
        detections={detections}
        selectedId={selectedId}
        meta={meta}
        sortDir={sortDir}
        onSelect={(id) => {
          setSelectedId(id);
          setCreating(false);
        }}
      />

      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        title={
          creating
            ? "Catat Insiden"
            : `Detail Deteksi — ${selected?.area.name ?? ""}`
        }
      >
        {creating ? (
          <NewDetectionForm areas={areas} onDone={closeDrawer} />
        ) : selected ? (
          <DetectionPanel
            detection={selected}
            areas={areas}
            onClose={closeDrawer}
          />
        ) : null}
      </Drawer>
    </div>
  );
}
