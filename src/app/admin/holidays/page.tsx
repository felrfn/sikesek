import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { getHolidays } from "@/features/holidays/service";
import { HolidaysClient } from "./HolidaysClient";

export const dynamic = "force-dynamic";

export default async function HolidaysPage() {
  const holidays = await getHolidays();

  return (
    <div>
      <AdminTopbar title="Holidays" />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Holiday Management</h1>
        <p className="text-sm text-gray-500">
          Configure dates that are closed for booking, or that use holiday pricing.
        </p>

        <div className="mt-5">
          <HolidaysClient holidays={holidays} />
        </div>
      </div>
    </div>
  );
}
