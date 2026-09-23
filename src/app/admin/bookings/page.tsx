import { CalendarCheck, Clock, ListChecks } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { getUnifiedBookings } from "@/features/bookings/service";
import { BookingsTable } from "./BookingsTable";

export const dynamic = "force-dynamic";

export default async function BookingsPage() {
  const rows = await getUnifiedBookings();
  const pending = rows.filter((r) => r.bookingStatus === "PENDING").length;
  const confirmed = rows.filter((r) => r.bookingStatus === "CONFIRMED").length;

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Reservation Management
        </h1>
        <p className="text-sm text-gray-500">
          Monitor and manage facility bookings across all locations.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <ListChecks className="size-5 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">Total Reservations</p>
            <p className="text-2xl font-bold text-gray-900">{rows.length}</p>
          </Card>
          <Card className="p-4">
            <CalendarCheck className="size-5 text-green-500" />
            <p className="mt-3 text-sm text-gray-500">Confirmed</p>
            <p className="text-2xl font-bold text-gray-900">{confirmed}</p>
          </Card>
          <Card className="p-4">
            <Clock className="size-5 text-amber-500" />
            <p className="mt-3 text-sm text-gray-500">Pending</p>
            <p className="text-2xl font-bold text-gray-900">{pending}</p>
          </Card>
        </div>

        <div className="mt-5">
          <BookingsTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
