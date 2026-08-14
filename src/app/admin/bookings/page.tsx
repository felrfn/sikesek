import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { getAllBookings } from '@/actions/admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Eye } from 'lucide-react';

export default async function AdminBookingsPage() {
  const data = await getAllBookings();

  return (
    <>
      <AdminTopbar title="SIKESEK Admin" />
      
      <main className="p-8 max-w-6xl">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Reservation Management</h1>
            <p className="text-sm text-slate-500">Monitor and manage facility bookings across all locations.</p>
          </div>
          <Button className="bg-[#0a4226] hover:bg-[#07301c] gap-2">
            <Plus className="w-4 h-4" /> New Booking
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Total Reservations</p>
              <h3 className="text-3xl font-bold text-slate-800">{data.total}</h3>
              <p className="text-xs text-slate-400 mt-2">↗ +12% this month</p>
            </div>
            <div className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center">
              <span className="text-slate-500">📄</span>
            </div>
          </Card>

          <Card className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1 flex items-center gap-2">
                Active Now <span className="w-1.5 h-1.5 bg-red-500 rounded-full"></span>
              </p>
              <h3 className="text-3xl font-bold text-slate-800">{data.active}</h3>
              <p className="text-xs text-slate-400 mt-2">Currently checked-in</p>
            </div>
            <div className="w-12 h-12 bg-emerald-50 rounded-full flex items-center justify-center">
              <span className="text-emerald-600">🏃</span>
            </div>
          </Card>

          <Card className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500 mb-1">Pending</p>
              <h3 className="text-3xl font-bold text-slate-800">{data.pending}</h3>
              <p className="text-xs text-[#0a4226] mt-2 font-semibold flex items-center gap-1 cursor-pointer">
                Review now →
              </p>
            </div>
            <div className="w-12 h-12 bg-orange-50 rounded-full flex items-center justify-center">
              <span className="text-orange-500">⌛</span>
            </div>
          </Card>
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-white">
            <div className="flex gap-4 items-center">
              <input 
                type="text" 
                placeholder="Search by ID, Name, or Facility" 
                className="text-sm border-slate-200 rounded-lg p-2 px-4 w-64 text-slate-600 bg-white border outline-none focus:ring-1 focus:ring-[#0a4226]"
              />
              <button className="text-sm border-slate-200 rounded-lg p-2 px-4 text-slate-600 bg-white border flex items-center gap-2">
                📅 Oct 23 - Oct 26, 2024 ▾
              </button>
            </div>
            <div className="flex gap-2 text-sm bg-slate-50 p-1 rounded-lg border border-slate-200">
              <button className="px-4 py-1.5 rounded-md bg-[#0a4226] text-white font-medium shadow-sm">All</button>
              <button className="px-4 py-1.5 rounded-md text-slate-600 hover:bg-slate-200">Pending</button>
              <button className="px-4 py-1.5 rounded-md text-slate-600 hover:bg-slate-200">Confirmed</button>
              <button className="px-4 py-1.5 rounded-md text-slate-600 hover:bg-slate-200">Checked-in</button>
              <button className="px-4 py-1.5 rounded-md text-slate-600 hover:bg-slate-200">Completed</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Booking ID</th>
                  <th className="px-6 py-4 font-medium">Visitor Name</th>
                  <th className="px-6 py-4 font-medium">Facility</th>
                  <th className="px-6 py-4 font-medium">Date & Time</th>
                  <th className="px-6 py-4 font-medium">Payment</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {data.list.map((booking) => (
                  <tr key={booking.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4 font-semibold text-[#0a4226]">{booking.bookingId}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center text-xs">
                          {booking.visitorInitials}
                        </div>
                        <span className="font-medium text-slate-800">{booking.visitorName}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{booking.facility}</td>
                    <td className="px-6 py-4">
                      <p className="text-slate-800 font-medium">{booking.date}</p>
                      <p className="text-xs text-slate-400">{booking.time}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-semibold border flex items-center gap-1 w-fit ${booking.paymentStatus === 'paid' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-orange-50 text-orange-700 border-orange-200'}`}>
                        {booking.paymentStatus === 'paid' ? <span className="text-green-500">✓</span> : <span className="text-orange-500">◷</span>}
                        {booking.paymentStatus.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${booking.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : booking.status === 'pending' ? 'bg-orange-100 text-orange-700' : booking.status === 'completed' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700'}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      {booking.status === 'confirmed' ? (
                        <button className="bg-[#0a4226] text-white px-4 py-1.5 rounded-lg text-xs font-semibold hover:bg-[#07301c]">Check-in</button>
                      ) : (
                        <button className="text-slate-400 hover:text-slate-800 p-2"><Eye className="w-4 h-4" /></button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t bg-white flex justify-between items-center text-sm text-slate-500">
            <p>Showing 1-{data.list.length} of {data.total} entries</p>
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
