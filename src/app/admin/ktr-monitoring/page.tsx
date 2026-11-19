import Link from "next/link";
import { Camera, CircleCheck, ClipboardList, TriangleAlert } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import {
  getDetectionsPage,
  getKtrStats,
  type KtrView,
} from "@/features/violations/adminService";
import {
  buildPaginationMeta,
  parseDateRangeParams,
  parsePagination,
} from "@/lib/utils/adminQuery";
import type { DetectionStatus } from "@prisma/client";
import { DETECTION_STATUS_OPTIONS } from "@/features/violations/display";
import { KtrClient } from "./KtrClient";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function KtrMonitoringPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const view: KtrView = first(params.view) === "all" ? "all" : "today";

  const rawStatuses = first(params.statuses);
  const legacyStatus = first(params.status);
  const statuses = (
    rawStatuses ? rawStatuses.split(",") : legacyStatus ? [legacyStatus] : []
  ).filter((value): value is DetectionStatus =>
    (DETECTION_STATUS_OPTIONS as string[]).includes(value),
  );

  const pagination = parsePagination(params);
  const dateRange = parseDateRangeParams(params);
  const dateActive = Boolean(dateRange.from || dateRange.to);
  const sortDir = first(params.dir) === "asc" ? "asc" : "desc";

  const [{ detections: rawDetections, total }, stats, areas] = await Promise.all([
    getDetectionsPage({
      view,
      statuses,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      sortDir,
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

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Catatan Pelanggaran KTR
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Pemantauan AI kawasan tanpa rokok secara real-time.
            </p>
          </div>
          <Link
            href="/admin/ktr-areas"
            className="text-sm font-medium text-brand-700 hover:underline"
          >
            Kelola area terpantau
          </Link>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-red-50 p-4">
            <TriangleAlert className="size-5 text-red-600" />
            <p className="mt-3 text-sm text-gray-500">Pelanggaran Hari Ini</p>
            <p className="text-2xl font-bold text-red-700">
              {stats.violationsToday}
            </p>
          </Card>
          <Card className="bg-amber-50 p-4">
            <ClipboardList className="size-5 text-amber-600" />
            <p className="mt-3 text-sm text-gray-500">
              Terdeteksi / Ditugaskan
            </p>
            <p className="text-2xl font-bold text-amber-700">
              {stats.loggedToday}
              <span className="ml-2 text-xs font-normal text-amber-700/70">
                {stats.assigned} ditugaskan &middot; {stats.inProgress} diproses
              </span>
            </p>
          </Card>
          <Card className="bg-green-50 p-4">
            <CircleCheck className="size-5 text-green-600" />
            <p className="mt-3 text-sm text-gray-500">
              Selesai / False Positive
            </p>
            <p className="text-2xl font-bold text-green-700">
              {stats.totalResolved}
              <span className="ml-2 text-xs font-normal text-green-700/70">
                {stats.falsePositive} false positive
              </span>
            </p>
          </Card>
          <Card className="bg-brand-50 p-4">
            <Camera className="size-5 text-brand-700" />
            <p className="mt-3 text-sm text-gray-500">Kamera Online</p>
            <p className="text-2xl font-bold text-brand-800">
              {stats.camerasOnline}/{stats.camerasTotal}
            </p>
          </Card>
        </div>

        <div className="mt-5">
          <KtrClient
            detections={detections}
            areas={areas}
            meta={meta}
            statuses={statuses}
            dateActive={dateActive}
            sortDir={sortDir}
          />
        </div>
      </div>
    </div>
  );
}
