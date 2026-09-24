import { Camera, CircleCheck, ClipboardList, TriangleAlert } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { prisma } from "@/lib/prisma";
import { getDetections, getKtrStats } from "@/features/violations/adminService";
import { KtrClient } from "./KtrClient";

export const dynamic = "force-dynamic";

export default async function KtrMonitoringPage() {
  const [rawDetections, stats, areas] = await Promise.all([
    getDetections(),
    getKtrStats(),
    prisma.monitoredArea.findMany({ orderBy: { name: "asc" } }),
  ]);
  const detections = rawDetections.map((d) => ({
    ...d,
    confidence: Number(d.confidence),
  }));

  return (
    <div>
      <AdminTopbar searchPlaceholder="Search evidence, locations..." />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          KTR Violations Log
        </h1>
        <p className="text-sm text-gray-500">
          Real-time AI monitoring of smoke-free zones.
        </p>

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
            <p className="mt-3 text-sm text-gray-500">Logged Today</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.loggedToday}
            </p>
          </Card>
          <Card className="p-4">
            <CircleCheck className="size-5 text-green-500" />
            <p className="mt-3 text-sm text-gray-500">Total Resolved</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalResolved}
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

        <div className="mt-5">
          <KtrClient detections={detections} areas={areas} />
        </div>
      </div>
    </div>
  );
}
