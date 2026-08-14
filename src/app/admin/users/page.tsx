import { AdminTopbar } from '@/components/admin/AdminTopbar';
import { Card } from '@/components/ui/card';

export default function AdminUsersPage() {
  return (
    <>
      <AdminTopbar title="SIKESEK Admin" />
      
      <main className="p-8 max-w-6xl">
        <div className="flex justify-between items-end mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 mb-1">User Management</h1>
            <p className="text-sm text-slate-500">Manage admin and employee accounts.</p>
          </div>
        </div>

        <Card className="p-12 flex flex-col items-center justify-center text-slate-400">
          <p className="mb-2">User Management Module</p>
          <p className="text-xs">Coming soon</p>
        </Card>
      </main>
    </>
  );
}
