"use client";

import { useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/admin/Pagination";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import type { PaginationMeta } from "@/lib/utils/adminQuery";
import { resolveDetection } from "@/features/violations/actions";
import { EvidenceImage } from "./EvidenceImage";
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

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function KtrTable({
  detections,
  selectedId,
  meta,
  onSelect,
}: {
  detections: DetectionForPanel[];
  selectedId: string | null;
  meta: PaginationMeta;
  onSelect: (id: string) => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card>
      <div className="overflow-x-auto rounded-t-xl">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-gray-50 text-xs tracking-wide text-gray-400 uppercase">
            <tr>
              <th className="px-4 py-3">Bukti</th>
              <th className="px-4 py-3">Lokasi</th>
              <th className="px-4 py-3">Waktu</th>
              <th className="px-4 py-3">Kepercayaan</th>
              <th className="px-4 py-3">Sumber</th>
              <th className="px-4 py-3">Ditugaskan</th>
              <th className="px-4 py-3">Status</th>
              <th className="w-28 px-4 py-3 text-right">
                <span className="sr-only">Aksi</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {detections.map((d) => (
              <tr
                key={d.id}
                onClick={() => onSelect(d.id)}
                title="Klik untuk melihat detail"
                className={`cursor-pointer transition-colors ${
                  selectedId === d.id
                    ? "bg-brand-50"
                    : "hover:bg-gray-50/70"
                }`}
              >
                <td className="px-4 py-3">
                  <EvidenceImage
                    evidenceKey={d.evidenceKey}
                    className="size-12 rounded-md bg-gray-100"
                    compact
                  />
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                  {d.area.name}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                  {formatShortDate(d.detectedAt)}
                  <br />
                  <span className="text-xs">{formatTime(d.detectedAt)} WIB</span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-9 text-xs text-gray-500">
                      {(d.confidence * 100).toFixed(0)}%
                    </span>
                    <span className="h-1.5 w-16 overflow-hidden rounded-full bg-gray-100">
                      <span
                        className="block h-full rounded-full bg-brand-600"
                        style={{
                          width: `${Math.min(100, Math.max(0, d.confidence * 100))}%`,
                        }}
                      />
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500">{d.source}</td>
                <td className="px-4 py-3 text-gray-500">
                  {d.assignments.length > 0
                    ? d.assignments.map((a) => a.assignedTo.name).join(", ")
                    : "-"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={statusTone[d.status]}>
                    {statusLabel(d.status)}
                  </Badge>
                </td>
                <td
                  className="px-4 py-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex justify-end">
                    {!CLOSED_STATUSES.has(d.status) ? (
                      <Button
                        size="sm"
                        disabled={isPending}
                        onClick={() =>
                          startTransition(() => resolveDetection(d.id))
                        }
                      >
                        Resolve
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => onSelect(d.id)}
                      >
                        Detail
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}

            {detections.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  Belum ada pelanggaran yang tercatat untuk filter ini.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <Pagination meta={meta} />
    </Card>
  );
}
