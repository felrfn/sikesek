import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { getHolidays } from "@/features/holidays/service";
import { HolidaysClient } from "./HolidaysClient";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const holidays = await getHolidays();

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Manajemen Hari Libur</h1>
        <p className="mt-1 text-sm text-gray-500">
          Atur tanggal yang ditutup untuk booking, atau yang memakai harga hari
          libur.
        </p>

        <div className="mt-5">
          <HolidaysClient holidays={holidays} />
        </div>
      </div>
    </div>
  );
}
