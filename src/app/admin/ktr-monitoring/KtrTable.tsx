"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Pagination } from "@/components/admin/Pagination";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import type { PaginationMeta } from "@/lib/utils/adminQuery";
import { resolveDetection } from "@/features/violations/actions";
import {
  detectionStatusLabel,
  detectionStatusTone,
  isClosedDetectionStatus,
} from "@/features/violations/display";
import { EvidenceImage } from "./EvidenceImage";
import type { DetectionForPanel } from "./types";

export function KtrTable({
  detections,
  selectedId,
  meta,
  sortDir,
  onSelect,
}: {
  detections: DetectionForPanel[];
  selectedId: string | null;
  meta: PaginationMeta;
  sortDir: "asc" | "desc";
  onSelect: (id: string) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function toggleTimeSort() {
    const next = new URLSearchParams(searchParams.toString());
    next.set("dir", sortDir === "asc" ? "desc" : "asc");
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  return (
    <Card>
      <div className="overflow-x-auto rounded-t-xl">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="bg-gray-50 text-xs tracking-wide text-gray-400 uppercase">
            <tr>
              <th className="px-4 py-3">Bukti</th>
              <th className="px-4 py-3">Lokasi</th>
              <th className="px-4 py-3">
                <button
                  type="button"
                  onClick={toggleTimeSort}
                  title="Urutkan berdasarkan waktu"
                  className="inline-flex items-center gap-1 transition-colors hover:text-gray-700"
                >
                  Waktu
                  {sortDir === "asc" ? (
                    <ArrowUp className="size-3.5 text-brand-700" />
                  ) : (
                    <ArrowDown className="size-3.5 text-brand-700" />
                  )}
                </button>
              </th>
              <th className="px-4 py-3">confidence</th>
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
                  <Badge tone={detectionStatusTone(d.status)}>
                    {detectionStatusLabel(d.status)}
                  </Badge>
                </td>
                <td
                  className="px-4 py-3"
                  onClick={(event) => event.stopPropagation()}
                >
                  <div className="flex justify-end">
                    {!isClosedDetectionStatus(d.status) ? (
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
