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
          User Management
        </h1>
        <p className="text-sm text-gray-500">
          Manage administrative staff, roles, and system access.
        </p>

        <div className="mt-5">
          <UsersClient users={users} />
        </div>
      </div>
    </div>
  );
}
