import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { getAllPayments } from '@/actions/admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Download } from 'lucide-react';
import Image from 'next/image';

export default async function AdminPaymentsPage() {
  const data = await getAllPayments();

  return (
    <>
      <AdminTopbar title="SIKESEK Admin" />
      
      <main className="p-8 max-w-6xl">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Payment Management</h1>
            <p className="text-sm text-slate-500">Overview and verification of facility transactions.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Download className="w-4 h-4" /> Export CSV
            </Button>
            <Button className="bg-[#0a4226] hover:bg-[#07301c] gap-2">
              <Plus className="w-4 h-4" /> New Invoice
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-emerald-50 rounded text-emerald-600 flex items-center justify-center">
                <span className="text-xs">Rp</span>
              </div>
              <p className="text-sm text-slate-500">Total Revenue (YTD)</p>
            </div>
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-slate-800">Rp {data.revenue.toLocaleString()}</h3>
              <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-full">
                ↗ 12.5%
              </span>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-orange-50 rounded text-orange-600 flex items-center justify-center">
                <span className="text-xs">↩</span>
              </div>
              <p className="text-sm text-slate-500">Refunded</p>
            </div>
            <h3 className="text-2xl font-bold text-slate-800">{data.refunded}</h3>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-6 h-6 bg-blue-50 rounded text-blue-600 flex items-center justify-center">
                <span className="text-xs">✓</span>
              </div>
              <p className="text-sm text-slate-500">Transaction Success Rate</p>
            </div>
            <div className="flex justify-between items-end">
              <h3 className="text-2xl font-bold text-slate-800">{data.successRate}%</h3>
              <p className="text-xs text-slate-400">Last 30 days</p>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-white">
            <h3 className="font-bold text-slate-800">Recent Transactions</h3>
            <select className="text-sm border-slate-200 rounded-lg p-2 text-slate-600 bg-white border">
              <option>All Status</option>
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Transaction ID</th>
                  <th className="px-6 py-4 font-medium">Date & Time</th>
                  <th className="px-6 py-4 font-medium">User / Facility</th>
                  <th className="px-6 py-4 font-medium">Amount</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.list.map((trx) => (
                  <tr key={trx.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-semibold text-[#0a4226]">{trx.transactionId}</td>
                    <td className="px-6 py-4">
                      <p className="text-slate-800">{trx.date}</p>
                      <p className="text-xs text-slate-400">{trx.time}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{trx.user}</p>
                      <p className="text-xs text-slate-400">{trx.facility}</p>
                    </td>
                    <td className="px-6 py-4 font-bold text-slate-800">{trx.amount}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        trx.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' :
                        trx.status === 'pending' ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                        'bg-red-100 text-red-700 border border-red-200'
                      }`}>
                        {trx.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button className="bg-[#0a4226] text-white px-3 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#07301c] flex items-center justify-center ml-auto gap-1">
                        WA
                      </button>
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
