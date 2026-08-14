import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { getAllFacilities } from '@/actions/admin';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import Image from 'next/image';

export default async function AdminFacilitiesPage() {
  const facilities = await getAllFacilities();

  return (
    <>
      <AdminTopbar title="SIKESEK Admin" />
      
      <main className="p-8 max-w-6xl">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">Facilities Management</h1>
            <p className="text-sm text-slate-500">Manage and monitor all available properties and spaces.</p>
          </div>
          <Button className="bg-[#0a4226] hover:bg-[#07301c] gap-2">
            <Plus className="w-4 h-4" /> Add New Facility
          </Button>
        </div>

        <Card className="overflow-hidden">
          <div className="p-4 border-b flex justify-between items-center bg-white">
            <div className="flex gap-2">
              <select className="text-sm border-slate-200 rounded-lg p-2 text-slate-600 bg-white border">
                <option>All Categories</option>
              </select>
              <select className="text-sm border-slate-200 rounded-lg p-2 text-slate-600 bg-white border">
                <option>All Status</option>
              </select>
            </div>
            <p className="text-xs text-slate-500">Showing 1-{facilities.length} of {facilities.length} facilities</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-slate-500 uppercase bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4 font-medium">Photo</th>
                  <th className="px-6 py-4 font-medium">Name</th>
                  <th className="px-6 py-4 font-medium">Category</th>
                  <th className="px-6 py-4 font-medium">Capacity</th>
                  <th className="px-6 py-4 font-medium">Price</th>
                  <th className="px-6 py-4 font-medium">Status</th>
                  <th className="px-6 py-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {facilities.map((fac) => (
                  <tr key={fac.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="w-12 h-12 rounded-lg bg-slate-200 overflow-hidden relative">
                        <Image src="/images/aren1.jpg" alt={fac.name} fill className="object-cover" sizes="48px" />
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">{fac.name}</p>
                      <p className="text-xs text-slate-400">SKU: {fac.id.substring(0,6).toUpperCase()}</p>
                    </td>
                    <td className="px-6 py-4 text-slate-600">{fac.category}</td>
                    <td className="px-6 py-4 text-slate-600">{fac.capacity}</td>
                    <td className="px-6 py-4 font-medium text-slate-800">{fac.price}</td>
                    <td className="px-6 py-4">
                      {fac.isActive ? (
                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span> Active
                        </span>
                      ) : (
                        <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-semibold flex items-center gap-1 w-fit">
                          <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span> Maintenance
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex justify-end gap-2 text-slate-400">
                        <button className="hover:text-[#0a4226] p-1"><Edit2 className="w-4 h-4" /></button>
                        <button className="hover:text-red-500 p-1"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          
          <div className="p-4 border-t bg-white flex justify-end">
            <div className="flex items-center gap-4 text-sm text-slate-500">
              <button className="hover:text-slate-800">&lt;</button>
              <span>Page 1 of 3</span>
              <button className="hover:text-slate-800">&gt;</button>
            </div>
          </div>
        </Card>
      </main>
    </>
  );
}
