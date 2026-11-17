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

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Card className="bg-brand-50 p-4">
            <Building2 className="size-5 text-brand-700" />
            <p className="mt-3 text-sm text-gray-500">Total Fasilitas</p>
            <p className="text-2xl font-bold text-brand-800">
              {rows.length}
            </p>
          </Card>
          <Card className="bg-green-50 p-4">
            <CheckCircle2 className="size-5 text-green-600" />
            <p className="mt-3 text-sm text-gray-500">Aktif</p>
            <p className="text-2xl font-bold text-green-700">
              {activeCount}
            </p>
          </Card>
          <Card className="bg-amber-50 p-4">
            <XCircle className="size-5 text-amber-600" />
            <p className="mt-3 text-sm text-gray-500">Nonaktif</p>
            <p className="text-2xl font-bold text-amber-700">
              {inactiveCount}
            </p>
          </Card>
        </div>

        <div className="mt-5">
          <FacilitiesTable rows={rows} />
        </div>
      </div>
    </div>
  );
}
