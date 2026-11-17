"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  GraduationCap,
  House,
  ImageIcon,
  Loader2,
  MapPin,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { FacilityCategory } from "@/features/facilities/service";
import { createFacility, updateFacility } from "@/features/facilities/actions";
import { HomestayFacilitiesPicker } from "./HomestayFacilitiesPicker";
import { EdutripIncludedItemsPicker } from "./EdutripIncludedItemsPicker";

interface FacilityFormProps {
  category: FacilityCategory;
  mode: "create" | "edit";
  facilityId?: string;
  initial?: Record<string, string | number | boolean | null>;
}

const CATEGORY_META = {
  homestay: {
    label: "Homestay",
    icon: House,
    badge: "bg-brand-50 text-brand-700",
    hint: "Properti menginap dengan harga per malam, kapasitas, kamar, dan amenitas.",
  },
  venue: {
    label: "Meeting Point",
    icon: MapPin,
    badge: "bg-blue-50 text-blue-700",
    hint: "Ruang atau titik pertemuan dengan harga sewa per jam.",
  },
  edutrip: {
    label: "Edutrip",
    icon: GraduationCap,
    badge: "bg-amber-50 text-amber-700",
    hint: "Paket kegiatan edukasi dengan harga per peserta dan daftar item termasuk.",
  },
} as const;

export function FacilityForm({
  category,
  mode,
  facilityId,
  initial,
}: FacilityFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  const meta = CATEGORY_META[category];
  const CategoryIcon = meta.icon;
  const isEdit = mode === "edit";
  const currentImage =
    typeof initial?.imageUrl === "string" && initial.imageUrl
      ? initial.imageUrl
      : null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result =
      mode === "create"
        ? await createFacility(category, formData)
        : await updateFacility(category, facilityId!, formData);

    setIsSubmitting(false);

    if (result?.error) {
      setError(result.error);
      return;
    }

    router.push("/admin/facilities");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start"
    >
      <Card className="p-6">
        <div className="space-y-8">
          <Section
            title="Informasi Dasar"
            description="Nama dan deskripsi yang tampil di katalog publik."
          >
            <div className="grid gap-4">
              <Field
                label="Nama Fasilitas"
                name="name"
                defaultValue={initial?.name}
                placeholder="Contoh: AREN 1"
                required
              />

              {category === "homestay" || category === "venue" ? (
                <label className="block text-sm font-medium text-gray-700">
                  Deskripsi
                  <span className="ml-1 font-normal text-gray-400">
                    (opsional)
                  </span>
                  <textarea
                    name="description"
                    defaultValue={
                      typeof initial?.description === "string"
                        ? initial.description
                        : ""
                    }
                    rows={3}
                    placeholder="Ceritakan keunggulan fasilitas ini..."
                    className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                  />
                </label>
              ) : null}
            </div>
          </Section>

          {category === "homestay" || category === "venue" ? (
            <Section
              title="Foto"
              description="Satu foto utama untuk kartu fasilitas di katalog publik."
            >
              <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-gray-300 p-4">
                {currentImage ? (
                  // eslint-disable-next-line @next/next/no-img-element -- R2 public URL / static seed asset
                  <img
                    src={currentImage}
                    alt={`Foto ${typeof initial?.name === "string" ? initial.name : "fasilitas"}`}
                    className="h-16 w-24 rounded-md object-cover ring-1 ring-gray-200"
                  />
                ) : (
                  <span className="flex h-16 w-24 items-center justify-center rounded-md bg-gray-50 text-gray-300 ring-1 ring-gray-200">
                    <ImageIcon className="size-6" />
                  </span>
                )}

                <div>
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
                    <Upload className="size-4" />
                    Pilih Gambar
                    <input
                      type="file"
                      name="image"
                      accept="image/*"
                      className="sr-only"
                      onChange={(event) =>
                        setFileName(event.target.files?.[0]?.name ?? null)
                      }
                    />
                  </label>
                  <p className="mt-1.5 text-xs text-gray-500">
                    {fileName ??
                      (currentImage ? "Foto saat ini" : "Belum ada file dipilih")}
                  </p>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Format PNG atau JPG.
                {isEdit
                  ? " Kosongkan jika tidak ingin mengganti foto."
                  : ""}
              </p>
            </Section>
          ) : null}

          {category === "homestay" ? (
            <Section
              title="Kapasitas & Kamar"
              description="Batas jumlah tamu dan jumlah kamar/bed yang tersedia."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Minimal Kapasitas"
                  name="minCapacity"
                  type="number"
                  min={1}
                  defaultValue={initial?.minCapacity}
                  required
                />
                <Field
                  label="Maksimal Kapasitas"
                  name="maxCapacity"
                  type="number"
                  min={1}
                  defaultValue={initial?.maxCapacity}
                  required
                />
                <Field
                  label="Jumlah Kamar"
                  name="roomCount"
                  type="number"
                  min={1}
                  defaultValue={initial?.roomCount ?? 1}
                  required
                />
                <Field
                  label="Jumlah Bed"
                  name="bedCount"
                  type="number"
                  min={1}
                  defaultValue={initial?.bedCount ?? 1}
                  required
                />
              </div>
            </Section>
          ) : null}

          {category === "venue" ? (
            <Section
              title="Kapasitas"
              description="Batas minimum dan maksimum jumlah peserta."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Minimal Kapasitas"
                  name="minCapacity"
                  type="number"
                  min={1}
                  defaultValue={initial?.minCapacity}
                  required
                />
                <Field
                  label="Maksimal Kapasitas"
                  name="maxCapacity"
                  type="number"
                  min={1}
                  defaultValue={initial?.maxCapacity}
                  required
                />
              </div>
            </Section>
          ) : null}

          {category === "homestay" ? (
            <Section
              title="Harga"
              description="Harga sewa dalam Rupiah, dihitung per malam."
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Harga Hari Kerja"
                  name="weekdayPrice"
                  type="number"
                  min={0}
                  prefix="Rp"
                  defaultValue={initial?.weekdayPrice}
                  required
                />
                <Field
                  label="Harga Akhir Pekan"
                  name="weekendPrice"
                  type="number"
                  min={0}
                  prefix="Rp"
                  defaultValue={initial?.weekendPrice}
                  required
                />
                <Field
                  label="Harga Hari Libur"
                  name="holidayPrice"
                  type="number"
                  min={0}
                  prefix="Rp"
                  defaultValue={initial?.holidayPrice}
                  required
                />
                <Field
                  label="Harga Bed Tambahan"
                  name="extraBedPrice"
                  type="number"
                  min={0}
                  prefix="Rp"
                  defaultValue={initial?.extraBedPrice ?? 0}
                />
              </div>
            </Section>
          ) : null}

          {category === "venue" ? (
            <Section
              title="Harga"
              description="Harga sewa dalam Rupiah, dihitung per jam."
            >
              <Field
                label="Harga per Jam"
                name="pricePerHour"
                type="number"
                min={0}
                prefix="Rp"
                defaultValue={initial?.pricePerHour}
                required
              />
            </Section>
          ) : null}

          {category === "edutrip" ? (
            <Section
              title="Harga & Popularitas"
              description="Harga paket dihitung per peserta."
            >
              <div className="grid gap-4">
                <Field
                  label="Harga per Pax"
                  name="pricePerPax"
                  type="number"
                  min={0}
                  prefix="Rp"
                  defaultValue={initial?.pricePerPax}
                  required
                />
                <label className="flex items-start gap-3 rounded-lg border border-gray-200 p-3 text-sm">
                  <input
                    type="checkbox"
                    name="isPopular"
                    value="true"
                    defaultChecked={Boolean(initial?.isPopular)}
                    className="mt-0.5 size-4 rounded border-gray-300 accent-brand-700"
                  />
                  <span>
                    <span className="font-medium text-gray-800">
                      Tandai sebagai populer
                    </span>
                    <span className="mt-0.5 block text-xs text-gray-500">
                      Paket ini akan ditonjolkan di katalog publik.
                    </span>
                  </span>
                </label>
              </div>
            </Section>
          ) : null}

          {category === "homestay" ? (
            <Section
              title="Fasilitas Homestay"
              description="Pilih amenitas yang tersedia dan tambahkan deskripsi khusus bila perlu."
            >
              <HomestayFacilitiesPicker homestayId={facilityId} />
            </Section>
          ) : null}

          {category === "edutrip" ? (
            <Section
              title="Item Termasuk"
              description="Susun daftar kegiatan atau fasilitas yang termasuk dalam paket."
            >
              <EdutripIncludedItemsPicker packageId={facilityId} />
            </Section>
          ) : null}

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          ) : null}

          <div className="flex gap-2 border-t border-gray-100 pt-5">
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Menyimpan…
                </>
              ) : (
                "Simpan"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => router.push("/admin/facilities")}
            >
              Batal
            </Button>
          </div>
        </div>
      </Card>

      <aside className="space-y-4 lg:sticky lg:top-6">
        {isEdit ? (
          <Card className="p-4">
            <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
              Tipe Fasilitas
            </p>
            <span
              className={cn(
                "mt-2 inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-medium",
                meta.badge,
              )}
            >
              <CategoryIcon className="size-4" />
              {meta.label}
            </span>
            <p className="mt-3 text-xs leading-relaxed text-gray-500">
              {meta.hint}
            </p>
          </Card>
        ) : null}

        <Card className="p-4">
          <p className="text-sm font-medium text-gray-900">Tips</p>
          <ul className="mt-2 space-y-2 text-xs leading-relaxed text-gray-500">
            <li>• Pastikan nama, kapasitas, dan harga sudah benar.</li>
            <li>• Foto landscape memberi hasil terbaik di katalog publik.</li>
          </ul>
        </Card>
      </aside>
    </form>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div>
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {description ? (
          <p className="mt-0.5 text-xs text-gray-500">{description}</p>
        ) : null}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
  placeholder,
  prefix,
  min,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | boolean | null;
  required?: boolean;
  placeholder?: string;
  prefix?: string;
  min?: number;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-white transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
        {prefix ? (
          <span className="pl-3 text-sm text-gray-400">{prefix}</span>
        ) : null}
        <input
          name={name}
          type={type}
          required={required}
          min={min}
          placeholder={placeholder}
          defaultValue={
            typeof defaultValue === "boolean"
              ? undefined
              : (defaultValue ?? undefined)
          }
          className={cn(
            "h-10 w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400",
            prefix ? "pr-3 pl-2" : "px-3",
          )}
        />
      </div>
    </label>
  );
}
