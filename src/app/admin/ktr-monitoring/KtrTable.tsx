"use client";

import { useTransition } from "react";
import { Eye } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import { resolveDetection } from "@/features/violations/actions";
import type { MonitoredArea, SmokingDetection } from "@prisma/client";

// `confidence` is serialized to a plain number before reaching this client
// component - Prisma's Decimal class instances aren't valid RSC payloads.
type Detection = Omit<SmokingDetection, "confidence"> & {
  confidence: number;
  area: MonitoredArea;
};

const statusTone = {
  DETECTED: "danger",
  NOTIFIED: "warning",
  RESOLVED: "success",
} as const;

export function KtrTable({ detections }: { detections: Detection[] }) {
  const [isPending, startTransition] = useTransition();

  return (
    <Card className="overflow-hidden">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-400">
          <tr>
            <th className="px-4 py-3">Evidence</th>
            <th className="px-4 py-3">Location</th>
            <th className="px-4 py-3">Time</th>
            <th className="px-4 py-3">Confidence</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3">Notes</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {detections.map((d) => (
            <tr key={d.id}>
              <td className="px-4 py-3">
                <a href={d.imageUrl} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element -- evidence images come from arbitrary external R2 hosts, not worth configuring remotePatterns for */}
                  <img
                    src={d.imageUrl}
                    alt="Evidence"
                    className="size-12 rounded-md object-cover"
                  />
                </a>
              </td>
              <td className="px-4 py-3 text-gray-700">{d.area.name}</td>
              <td className="px-4 py-3 text-gray-500">
                {formatShortDate(d.detectedAt)} {formatTime(d.detectedAt)}
              </td>
              <td className="px-4 py-3 text-gray-500">
                {(d.confidence * 100).toFixed(0)}%
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone[d.status]}>{d.status}</Badge>
              </td>
              <td className="px-4 py-3 max-w-[200px] truncate text-gray-400">
                {d.notes ?? "-"}
              </td>
              <td className="px-4 py-3 text-right">
                {d.status !== "RESOLVED" ? (
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
                  <a
                    href={d.imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-gray-400 hover:text-gray-600"
                  >
                    <Eye className="size-4" />
                  </a>
                )}
              </td>
            </tr>
          ))}
          {detections.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                No violations recorded yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>
  );
}
