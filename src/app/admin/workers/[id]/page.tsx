import { notFound } from "next/navigation";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import { getWorkerDetail, getWorkerScheduleForMonth } from "@/features/workers/service";
import { getTodayInJakarta } from "@/lib/siteConfig";
import { WorkerAvailabilityCalendar } from "../WorkerAvailabilityCalendar";

export const dynamic = "force-dynamic";

export default async function WorkerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { id } = await params;
  const { month } = await searchParams;
  const yearMonth = month ?? getTodayInJakarta().slice(0, 7);

  const [worker, schedule] = await Promise.all([
    getWorkerDetail(id),
    getWorkerScheduleForMonth(id, yearMonth),
  ]);

  if (!worker) notFound();

  return (
    <div>
      <AdminTopbar title={worker.name} />
      <div className="grid gap-5 p-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="font-semibold text-gray-900">{worker.name}</h2>
          <p className="text-sm text-gray-500">{worker.email}</p>
          {worker.phone ? <p className="text-sm text-gray-500">{worker.phone}</p> : null}
          <div className="mt-3 flex gap-2">
            <Badge tone={worker.approvedAt ? "success" : "neutral"}>
              {worker.approvedAt ? "Active" : "Pending approval"}
            </Badge>
            <Badge tone="info">{worker.role}</Badge>
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Availability</h3>
            <WorkerAvailabilityCalendar
              workerId={worker.id}
              yearMonth={yearMonth}
              schedule={schedule.map((s) => ({
                date: s.date.toISOString().slice(0, 10),
                status: s.status,
                note: s.note,
              }))}
            />
          </div>
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-gray-900">Assignment History</h3>
            <ul className="divide-y divide-gray-100 text-sm">
              {worker.ktrAssignmentsAsWorker.map((a) => (
                <li key={a.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-gray-800">{a.detection.area.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatShortDate(a.assignedAt)} {formatTime(a.assignedAt)}
                    </p>
                  </div>
                  <Badge tone="info">{a.status}</Badge>
                </li>
              ))}
              {worker.ktrAssignmentsAsWorker.length === 0 ? (
                <li className="py-4 text-center text-gray-400">No assignments yet.</li>
              ) : null}
            </ul>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-gray-900">Resolution History</h3>
            <ul className="divide-y divide-gray-100 text-sm">
              {worker.resolvedDetections.map((d) => (
                <li key={d.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-gray-800">{d.area.name}</p>
                    <p className="text-xs text-gray-400">
                      {d.resolvedAt ? `${formatShortDate(d.resolvedAt)} ${formatTime(d.resolvedAt)}` : "-"}
                    </p>
                  </div>
                  <Badge tone="success">{d.status}</Badge>
                </li>
              ))}
              {worker.resolvedDetections.length === 0 ? (
                <li className="py-4 text-center text-gray-400">No resolutions yet.</li>
              ) : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
