import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { getKtrMonitoring } from '@/actions/admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Filter, Download, Eye, UserX } from 'lucide-react';

export default async function AdminKtrMonitoringPage() {
  const data = await getKtrMonitoring();

  return (
    <>
      <AdminTopbar title="SIKESEK Admin" />
      
      <main className="p-8 max-w-6xl">
        <div className="flex justify-between items-end mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-slate-800">KTR Violations Log</h1>
              <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-200">
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse"></span> LIVE SCAN
              </span>
            </div>
            <p className="text-sm text-slate-500">Real-time AI monitoring of smoke-free zones.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Filter className="w-4 h-4" /> Filter
            </Button>
            <Button className="bg-[#0a4226] hover:bg-[#07301c] gap-2">
              <Download className="w-4 h-4" /> Export Report
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-red-50 rounded text-red-500 flex items-center justify-center">
                <UserX className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-slate-400 ml-auto">+12% vs last wk</span>
            </div>
            <p className="text-sm text-slate-500 mb-1">Total Violations Today</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.totalViolationsToday}</h3>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-orange-50 rounded text-orange-600 flex items-center justify-center">
                <span className="text-xs font-bold">📋</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-1">Logged Today</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.loggedToday}</h3>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-emerald-50 rounded text-emerald-600 flex items-center justify-center">
                <span className="text-xs font-bold">✓</span>
              </div>
            </div>
            <p className="text-sm text-slate-500 mb-1">Total Resolved</p>
            <h3 className="text-2xl font-bold text-slate-800">{data.totalResolved}</h3>
          </Card>

          <Card className="p-6 bg-[#0a4226] text-white">
            <div className="flex items-center justify-between mb-4">
              <div className="w-6 h-6 bg-[#125734] rounded flex items-center justify-center">
                <span className="text-xs">📷</span>
              </div>
              <span className="w-2 h-2 bg-green-400 rounded-full shadow-[0_0_8px_#4ade80]"></span>
            </div>
            <p className="text-sm text-green-100 mb-1">Cameras Online</p>
            <h3 className="text-2xl font-bold">{data.onlineCameras}/{data.totalCameras}</h3>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Evidence</th>
                  <th className="px-6 py-4 font-medium">Violation Type</th>
                  <th className="px-6 py-4 font-medium">Time & Location</th>
                  <th className="px-6 py-4 font-medium">AI Confidence</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.list.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="w-12 h-12 bg-slate-200 rounded-lg flex items-center justify-center text-slate-400">
                        <UserX className="w-6 h-6" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        {log.type === 'Smoking' ? (
                          <span className="text-red-500">🚬</span>
                        ) : (
                          <span className="text-slate-400">🗑️</span>
                        )}
                        <span className="font-medium text-slate-700">{log.type}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-slate-800 font-medium">{log.time}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <span className="text-[10px]">📍</span> {log.location}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${log.confidence > 90 ? 'bg-green-600' : log.confidence > 80 ? 'bg-orange-600' : 'bg-slate-400'}`} 
                            style={{ width: `${log.confidence}%` }}
                          ></div>
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{log.confidence.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        log.status === 'open' ? 'bg-red-100 text-red-700' :
                        log.status === 'assigned' ? 'bg-orange-100 text-orange-700' :
                        log.status === 'resolved' ? 'bg-emerald-100 text-emerald-700' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {log.status === 'open' ? 'LOGGED' : log.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="text-slate-400 hover:text-emerald-600 p-2"><Eye className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t bg-white flex justify-between items-center text-sm text-slate-500">
            <p>Showing 1 to {data.list.length} of {data.list.length} entries</p>
            <div className="flex items-center gap-2">
              <button className="p-1 hover:text-slate-800">&lt;</button>
              <button className="w-6 h-6 rounded bg-[#0a4226] text-white font-medium flex items-center justify-center">1</button>
              <button className="w-6 h-6 rounded hover:bg-slate-100 font-medium flex items-center justify-center">2</button>
              <button className="w-6 h-6 rounded hover:bg-slate-100 font-medium flex items-center justify-center">3</button>
              <button className="p-1 hover:text-slate-800">&gt;</button>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}
