import Link from "next/link";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { getWorkers } from "@/features/workers/service";
import { getTodayInJakarta } from "@/lib/siteConfig";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  const [workers, todaySchedules] = await Promise.all([
    getWorkers(),
    prisma.workerSchedule.findMany({ where: { date: new Date(getTodayInJakarta()) } }),
  ]);
  const scheduleByWorker = new Map(todaySchedules.map((s) => [s.workerId, s.status]));

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Worker Management</h1>
        <p className="text-sm text-gray-500">
          Field officer availability, schedule, and KTR task history.
        </p>

        <Card className="mt-5 overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-400">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Account Status</th>
                <th className="px-4 py-3">Today</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {workers.map((worker) => {
                const today = scheduleByWorker.get(worker.id) ?? "AVAILABLE";
                return (
                  <tr key={worker.id}>
                    <td className="px-4 py-3 font-medium text-gray-900">{worker.name}</td>
                    <td className="px-4 py-3 text-gray-500">
                      {worker.email}
                      {worker.phone ? <div className="text-xs text-gray-400">{worker.phone}</div> : null}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={worker.approvedAt ? "success" : "neutral"}>
                        {worker.approvedAt ? "Active" : "Pending approval"}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        tone={
                          today === "AVAILABLE"
                            ? "success"
                            : today === "UNAVAILABLE"
                              ? "danger"
                              : today === "LEAVE"
                                ? "warning"
                                : "neutral"
                        }
                      >
                        {today}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/workers/${worker.id}`}
                        className="text-sm font-medium text-brand-700 hover:underline"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {workers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    No field officers yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
}
