import { ListChecks, Plus } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { LinkButton } from "@/components/ui/Button";
import { getUnifiedFacilities } from "@/features/facilities/service";
import { FacilitiesTable } from "./FacilitiesTable";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const rows = await getUnifiedFacilities();

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Facilities Management
            </h1>
            <p className="text-sm text-gray-500">
              Manage and monitor all available properties and spaces.
            </p>
          </div>
          <div className="flex gap-2">
            <LinkButton href="/admin/amenities" variant="outline">
              <ListChecks className="size-4" />
              Manage Amenities
            </LinkButton>
            <LinkButton href="/admin/facilities/new" variant="primary">
              <Plus className="size-4" />
              Add New Facility
            </LinkButton>
          </div>
        </div>

        <div className="mt-5">
          <FacilitiesTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
