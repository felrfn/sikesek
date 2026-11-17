import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { getFacilityForEdit } from "@/features/facilities/actions";
import type { FacilityCategory } from "@/features/facilities/service";
import { FacilityForm } from "../../../FacilityForm";

const validCategories: FacilityCategory[] = ["homestay", "venue", "edutrip"];

export default async function EditFacilityPage({
  params,
}: {
  params: Promise<{ category: string; id: string }>;
}) {
  const { category, id } = await params;

  if (!validCategories.includes(category as FacilityCategory)) {
    notFound();
  }

  const facility = await getFacilityForEdit(category as FacilityCategory, id);
  if (!facility) notFound();

  // Prisma BigInt price fields aren't serializable across the RSC boundary,
  // so they're converted to plain numbers before reaching the client form.
  const initial = Object.fromEntries(
    Object.entries(facility).map(([key, value]) => [
      key,
      typeof value === "bigint" ? Number(value) : value,
    ]),
  ) as Record<string, string | number | boolean | null>;

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <div>
          <Link
            href="/admin/facilities"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-brand-700"
          >
            <ArrowLeft className="size-4" />
            Kembali ke Fasilitas
          </Link>
          <h1 className="mt-3 text-xl font-semibold text-gray-900">
            Edit Fasilitas
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            Perbarui data fasilitas yang sudah ada.
          </p>
        </div>

        <FacilityForm
          category={category as FacilityCategory}
          mode="edit"
          facilityId={id}
          initial={initial}
        />
      </div>
    </div>
  );
}
