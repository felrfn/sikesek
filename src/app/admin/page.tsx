import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { getDashboardMetrics, getRecentAlerts } from '@/actions/admin';
import { Ticket, Building2, PlugZap, AlertTriangle, CheckCircle2, Download } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AdminChart } from '@/components/admin/AdminChart';

export default async function AdminDashboardPage() {
  const metrics = await getDashboardMetrics();
  const alerts = await getRecentAlerts();

  return (
    <>
      <AdminTopbar title="Dashboard Overview" />
      
      <main className="p-8 max-w-6xl">
        <div className="flex justify-between items-center mb-6">
          <p className="text-sm text-slate-500">Real-time facility and tourism metrics.</p>
          <Button variant="outline" className="gap-2">
            <Download className="w-4 h-4" /> Export
          </Button>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center text-[#0a4226]">
                <Ticket className="w-5 h-5" />
              </div>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                ↗ 12%
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-1">Total Booking</p>
            <h3 className="text-3xl font-bold text-slate-800">{metrics.totalBookings.toLocaleString()}</h3>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center text-slate-600">
                <Building2 className="w-5 h-5" />
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-1">Total Facilities</p>
            <h3 className="text-3xl font-bold text-slate-800">{metrics.totalFacilities}</h3>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600">
                <PlugZap className="w-5 h-5" />
              </div>
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
            </div>
            <p className="text-sm text-slate-500 mb-1">Active Facilities</p>
            <h3 className="text-3xl font-bold text-slate-800">
              {metrics.activeFacilities} <span className="text-base font-normal text-slate-400">/ {metrics.totalFacilities}</span>
            </h3>
          </Card>

          <Card className="p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="w-10 h-10 bg-red-50 rounded-lg flex items-center justify-center text-red-500">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-1 rounded-full">TODAY</span>
            </div>
            <p className="text-sm text-slate-500 mb-1">KTR Violations</p>
            <h3 className="text-3xl font-bold text-red-500">{metrics.violationsToday}</h3>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chart */}
          <Card className="p-6 col-span-2">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-slate-800">Quick Tourism Stats</h3>
              <select className="text-sm border-slate-200 rounded-lg p-1 px-2 text-slate-600 bg-slate-50">
                <option>This Week</option>
              </select>
            </div>
            <div className="h-64 w-full">
              <AdminChart />
            </div>
          </Card>

          {/* Recent Alerts */}
          <Card className="p-6">
            <h3 className="font-bold text-slate-800 mb-6">Recent Alerts</h3>
            <div className="space-y-6">
              {alerts.recentDetections.map((detection) => (
                <div key={detection.id} className="flex gap-4">
                  <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">KTR Violation Detected</p>
                    <p className="text-xs text-slate-500 mb-1">Facility: {detection.area?.name || 'Unknown'}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(detection.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}
              
              {alerts.recentTransactions.map((trx) => (
                <div key={trx.id} className="flex gap-4">
                  <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Payment Cleared</p>
                    <p className="text-xs text-slate-500 mb-1">Booking {trx.invoiceNumber}</p>
                    <p className="text-[10px] text-slate-400">
                      {new Date(trx.createdAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
              ))}

              <Button variant="ghost" className="w-full text-sm text-[#0a4226] hover:text-[#0a4226] hover:bg-green-50">
                View All Alerts
              </Button>
            </div>
          </Card>
        </div>
      </main>
    </>
  );
}
