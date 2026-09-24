import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { getAmenities } from "@/features/facilities/amenityService";
import { AmenitiesClient } from "./AmenitiesClient";

export const dynamic = "force-dynamic";

export default async function AmenitiesPage() {
  const amenities = await getAmenities();

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Facility Amenities</h1>
        <p className="text-sm text-gray-500">
          Manage the amenity tags (bathroom, TV, Wi-Fi, ...) homestays can be assigned.
        </p>

        <div className="mt-5">
          <AmenitiesClient amenities={amenities} />
        </div>
      </div>
    </div>
  );
}
