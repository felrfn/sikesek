import { Building2, Plug, Ticket, TriangleAlert } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { BarChart } from "@/components/admin/BarChart";
import { formatCurrency, formatShortDate, formatTime } from "@/lib/utils/format";
import { getDashboardStats } from "@/features/dashboard/service";

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Dashboard Overview
        </h1>
        <p className="text-sm text-gray-500">
          Real-time facility and tourism metrics.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card className="p-4">
            <div className="flex items-center justify-between text-gray-400">
              <Ticket className="size-5" />
            </div>
            <p className="mt-3 text-sm text-gray-500">Total Booking</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalBookings.toLocaleString("id-ID")}
            </p>
          </Card>
          <Card className="p-4">
            <Building2 className="size-5 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">Total Facilities</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.totalFacilities}
            </p>
          </Card>
          <Card className="p-4">
            <Plug className="size-5 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">Active Facilities</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.activeFacilities}
              <span className="text-sm font-normal text-gray-400">
                /{stats.totalFacilities}
              </span>
            </p>
          </Card>
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <TriangleAlert className="size-5 text-red-400" />
              <Badge tone="danger">TODAY</Badge>
            </div>
            <p className="mt-3 text-sm text-gray-500">KTR Violations</p>
            <p className="text-2xl font-bold text-red-600">
              {stats.ktrViolationsToday}
            </p>
          </Card>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <Card className="p-5 lg:col-span-2">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">
                Quick Tourism Stats
              </h2>
              <span className="text-xs text-gray-400">Last 7 days</span>
            </div>
            <BarChart data={stats.bookingsByDay} />
          </Card>

          <Card className="p-5">
            <h2 className="font-semibold text-gray-900">Recent Alerts</h2>
            <div className="mt-3 space-y-3">
              {stats.recentDetections.map((detection) => (
                <div key={detection.id} className="flex gap-3 text-sm">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0 text-red-500" />
                  <div>
                    <p className="font-medium text-gray-800">
                      KTR Violation Detected
                    </p>
                    <p className="text-gray-500">
                      Facility: {detection.area.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatShortDate(detection.detectedAt)}{" "}
                      {formatTime(detection.detectedAt)}
                    </p>
                  </div>
                </div>
              ))}
              {stats.recentPayments.map((payment) => (
                <div key={payment.id} className="flex gap-3 text-sm">
                  <Ticket className="mt-0.5 size-4 shrink-0 text-green-600" />
                  <div>
                    <p className="font-medium text-gray-800">
                      Payment {payment.paymentStatus}
                    </p>
                    <p className="text-gray-500">
                      {payment.invoiceNumber} -{" "}
                      {formatCurrency(payment.totalAmount)}
                    </p>
                  </div>
                </div>
              ))}
              {stats.recentDetections.length === 0 &&
              stats.recentPayments.length === 0 ? (
                <p className="text-sm text-gray-400">No recent activity.</p>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
