import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { getStaffUsers } from "@/features/users/service";
import { UsersClient } from "./UsersClient";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const users = await getStaffUsers();

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Manajemen Pengguna
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Kelola staf administrasi, peran, dan akses sistem.
        </p>

        <div className="mt-5">
          <UsersClient users={users} />
        </div>
      </div>
    </div>
  );
}
