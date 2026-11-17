import {
  Building2,
  CheckCircle2,
  ListChecks,
  Plus,
  XCircle,
} from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/Button";
import { getUnifiedFacilities } from "@/features/facilities/service";
import { FacilitiesTable } from "./FacilitiesTable";

export const dynamic = "force-dynamic";

export default async function FacilitiesPage() {
  const rows = await getUnifiedFacilities();
  const activeCount = rows.filter((row) => row.isActive).length;
  const inactiveCount = rows.length - activeCount;

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">
              Manajemen Fasilitas
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Kelola dan pantau seluruh properti serta ruang yang tersedia.
            </p>
          </div>
          <div className="flex gap-2">
            <LinkButton href="/admin/amenities" variant="outline">
              <ListChecks className="size-4" />
              Kelola Amenitas
            </LinkButton>
            <LinkButton href="/admin/facilities/new" variant="primary">
              <Plus className="size-4" />
              Tambah Fasilitas
            </LinkButton>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <Card className="flex items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
              <Building2 className="size-4" />
            </span>
            <div>
              <p className="text-xs text-gray-500">Total Fasilitas</p>
              <p className="text-lg font-semibold text-gray-900">
                {rows.length}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-green-50 text-green-600">
              <CheckCircle2 className="size-4" />
            </span>
            <div>
              <p className="text-xs text-gray-500">Aktif</p>
              <p className="text-lg font-semibold text-gray-900">
                {activeCount}
              </p>
            </div>
          </Card>
          <Card className="flex items-center gap-3 p-4">
            <span className="flex size-9 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
              <XCircle className="size-4" />
            </span>
            <div>
              <p className="text-xs text-gray-500">Nonaktif</p>
              <p className="text-lg font-semibold text-gray-900">
                {inactiveCount}
              </p>
            </div>
          </Card>
        </div>

        <div className="mt-5">
          <FacilitiesTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
