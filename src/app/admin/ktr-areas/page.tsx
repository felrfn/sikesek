import { AdminTopbar } from "@/components/admin/AdminTopbar";
import {
  getAssignableOfficers,
  getKtrAreas,
} from "@/features/ktrAreas/service";
import type { KtrAreaRow } from "@/features/ktrAreas/types";
import { KtrAreasClient } from "./KtrAreasClient";

export const dynamic = "force-dynamic";

export default async function KtrAreasPage() {
  const [areas, officers] = await Promise.all([
    getKtrAreas(),
    getAssignableOfficers(),
  ]);

  const rows: KtrAreaRow[] = areas.map((area) => ({
    id: area.id,
    name: area.name,
    locationDescription: area.locationDescription,
    streamUrl: area.streamUrl,
    isActive: area.isActive,
    assignedEmployee: area.assignedEmployee,
    detectionCount: area._count.detections,
  }));

  return (
    <div>
      <AdminTopbar title="KTR Areas" />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Monitored Area Registry
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Every camera the YOLOv8 pipeline reports against must be registered
          here. The AI server pulls this list (id + optional stream URL) from{" "}
          <code className="rounded bg-gray-100 px-1 py-0.5 text-xs">
            GET /api/ktr/areas
          </code>
          , so never send it an area id that does not exist below.
        </p>

        <div className="mt-5">
          <KtrAreasClient areas={rows} officers={officers} />
        </div>
      </div>
    </div>
  );
}
