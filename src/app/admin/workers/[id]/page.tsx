import { notFound } from "next/navigation";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatShortDate, formatTime } from "@/lib/utils/format";
import { mailtoHref, whatsappHref } from "@/lib/utils/contact";
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
          <a
            href={mailtoHref(worker.email)}
            className="block text-sm text-gray-500 hover:text-brand-700 hover:underline"
          >
            {worker.email}
          </a>
          {worker.phone ? (
            <a
              href={whatsappHref(worker.phone)}
              target="_blank"
              rel="noreferrer"
              className="block text-sm text-gray-500 hover:text-brand-700 hover:underline"
            >
              {worker.phone}
            </a>
          ) : null}
          <div className="mt-3 flex gap-2">
            <Badge tone={worker.approvedAt ? "success" : "neutral"}>
              {worker.approvedAt ? "Aktif" : "Nonaktif"}
            </Badge>
            <Badge tone="info">
              {worker.role === "ADMIN" ? "Admin" : "Petugas Lapangan"}
            </Badge>
          </div>

          <div className="mt-6">
            <h3 className="mb-2 text-sm font-semibold text-gray-700">Ketersediaan</h3>
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
            <h3 className="mb-3 font-semibold text-gray-900">Riwayat Penugasan</h3>
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
                <li className="py-4 text-center text-gray-400">Belum ada penugasan.</li>
              ) : null}
            </ul>
          </Card>

          <Card className="p-5">
            <h3 className="mb-3 font-semibold text-gray-900">Riwayat Penyelesaian</h3>
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
                <li className="py-4 text-center text-gray-400">Belum ada penyelesaian.</li>
              ) : null}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
