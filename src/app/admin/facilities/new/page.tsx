import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { NewFacilityClient } from "./NewFacilityClient";

export default function NewFacilityPage() {
  return (
    <div>
      <AdminTopbar title="Add New Facility" />
      <div className="p-6">
        <NewFacilityClient />
      </div>
    </div>
  );
}
