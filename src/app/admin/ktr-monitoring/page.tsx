import Link from "next/link";
import { Camera, CircleCheck, ClipboardList, TriangleAlert } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/admin/Pagination";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { prisma } from "@/lib/prisma";
import { getDetectionsPage, getKtrStats, type KtrView } from "@/features/violations/adminService";
import {
  buildPaginationMeta,
  parseDateRangeParams,
  parsePagination,
} from "@/lib/utils/adminQuery";
import type { DetectionStatus } from "@prisma/client";
import { KtrClient } from "./KtrClient";
import { StatusFilter } from "./StatusFilter";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_OPTIONS: DetectionStatus[] = [
  "DETECTED",
  "NOTIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "FALSE_POSITIVE",
  "DISMISSED",
];

export default async function KtrMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view: KtrView = params.view === "all" ? "all" : "today";
  const status = STATUS_OPTIONS.includes(params.status as DetectionStatus)
    ? (params.status as DetectionStatus)
    : undefined;
  const pagination = parsePagination(params);
  const dateRange = parseDateRangeParams(params);

  const [{ detections: rawDetections, total }, stats, areas] = await Promise.all([
    getDetectionsPage({
      view,
      status,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      skip: pagination.skip,
      take: pagination.take,
    }),
    getKtrStats(),
    prisma.monitoredArea.findMany({ orderBy: { name: "asc" } }),
  ]);

  const detections = rawDetections.map((d) => ({
    id: d.id,
    areaId: d.areaId,
    area: d.area,
    confidence: Number(d.confidence),
    evidenceKey: d.evidenceKey,
    source: d.source,
    status: d.status,
    detectedAt: d.detectedAt.toISOString(),
    resolvedAt: d.resolvedAt ? d.resolvedAt.toISOString() : null,
    resolvedByUser: d.resolvedByUser,
    notes: d.notes,
    assignments: d.assignments.map((a) => ({
      id: a.id,
      status: a.status,
      assignedTo: a.assignedTo,
    })),
  }));

  const meta = buildPaginationMeta(total, pagination.page, pagination.pageSize);

  function tabHref(nextView: KtrView) {
    const next = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") next.set(key, value);
    }
    next.set("view", nextView);
    next.set("page", "1");
    return `/admin/ktr-monitoring?${next.toString()}`;
  }

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          KTR Violations Log
        </h1>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm text-gray-500">
            Real-time AI monitoring of smoke-free zones.
          </p>
          <Link
            href="/admin/ktr-areas"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Manage monitored areas
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <TriangleAlert className="size-5 text-red-400" />
            <p className="mt-3 text-sm text-gray-500">Total Violations Today</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.violationsToday}
            </p>
          </Card>
          <Card className="p-4">
            <ClipboardList className="size-5 text-amber-400" />
            <p className="mt-3 text-sm text-gray-500">
              Detected {stats.assigned + stats.inProgress > 0 ? "/ Assigned" : "Today"}
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.loggedToday}
              <span className="ml-2 text-sm font-normal text-gray-400">
                {stats.assigned} assigned Β· {stats.inProgress} in progress
              </span>
            </p>
          </Card>
          <Card className="p-4">
            <CircleCheck className="size-5 text-green-500" />
            <p className="mt-3 text-sm text-gray-500">Resolved / False Positive</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalResolved}
              <span className="ml-2 text-sm font-normal text-gray-400">
                {stats.falsePositive} false positive
              </span>
            </p>
          </Card>
          <Card className="bg-brand-800 p-4 text-white">
            <Camera className="size-5" />
            <p className="mt-3 text-sm text-brand-100">Cameras Online</p>
            <p className="text-2xl font-bold">
              {stats.camerasOnline}/{stats.camerasTotal}
            </p>
          </Card>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1 text-sm">
            <Link
              href={tabHref("today")}
              className={`rounded-md px-3 py-1.5 font-medium ${
                view === "today" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
              }`}
            >
              Today
            </Link>
            <Link
              href={tabHref("all")}
              className={`rounded-md px-3 py-1.5 font-medium ${
                view === "all" ? "bg-white text-brand-700 shadow-sm" : "text-gray-500"
              }`}
            >
              All
            </Link>
          </div>
          <DateRangeFilter label="Detected" />
        </div>

        <div className="mt-3">
          <StatusFilter />
        </div>

        <div className="mt-3">
          <KtrClient detections={detections} areas={areas} />
        </div>

        <Card className="mt-3">
          <Pagination meta={meta} />
        </Card>
      </div>
    </div>
  );
}

