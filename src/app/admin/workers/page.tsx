import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { getWorkers } from "@/features/workers/service";
import { getTodayInJakarta } from "@/lib/siteConfig";
import { prisma } from "@/lib/prisma";
import { WorkersTable } from "./WorkersTable";

export const dynamic = "force-dynamic";

export default async function WorkersPage() {
  const [workers, todaySchedules] = await Promise.all([
    getWorkers(),
    prisma.workerSchedule.findMany({ where: { date: new Date(getTodayInJakarta()) } }),
  ]);
  const scheduleByWorker = new Map(todaySchedules.map((s) => [s.workerId, s.status]));

  const rows = workers.map((worker) => ({
    id: worker.id,
    name: worker.name,
    email: worker.email,
    phone: worker.phone,
    approvedAt: worker.approvedAt,
    today: scheduleByWorker.get(worker.id) ?? "AVAILABLE",
  }));

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Manajemen Petugas</h1>
        <p className="mt-1 text-sm text-gray-500">
          Ketersediaan, jadwal, dan riwayat tugas petugas lapangan.
        </p>

        <div className="mt-5">
          <WorkersTable workers={rows} />
        </div>
      </div>
    </div>
  );
}
