"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  GraduationCap,
  House,
  ImagePlus,
  Loader2,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NumericInput } from "@/components/ui/NumericInput";
import { cn } from "@/lib/utils/cn";
import type { FacilityCategory } from "@/features/facilities/service";
import {
  MAX_FACILITY_IMAGE_LABEL,
  validateFacilityImage,
} from "@/features/facilities/imageRules";
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
  const [photoError, setPhotoError] = useState<string | null>(null);

  const meta = CATEGORY_META[category];
  const CategoryIcon = meta.icon;
  const isEdit = mode === "edit";
  const currentImage =
    typeof initial?.imageUrl === "string" && initial.imageUrl
      ? initial.imageUrl
      : null;
  const [preview, setPreview] = useState<string | null>(currentImage);

  function handlePhotoFile(
    file: File | undefined,
    input: HTMLInputElement,
  ) {
    if (!file) return;
    const violation = validateFacilityImage(file);
    if (violation) {
      // Reject the file so the invalid photo is never submitted.
      input.value = "";
      setPhotoError(violation);
      return;
    }
    setPhotoError(null);
    setPreview((previous) => {
      if (previous && previous.startsWith("blob:")) {
        URL.revokeObjectURL(previous);
      }
      return URL.createObjectURL(file);
    });
  }

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
              <label className="block cursor-pointer overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50/50 transition-colors hover:border-brand-400 hover:bg-brand-50/40 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
                <input
                  type="file"
                  name="image"
                  accept="image/*"
                  className="sr-only"
                  onChange={(event) =>
                    handlePhotoFile(
                      event.target.files?.[0],
                      event.currentTarget,
                    )
                  }
                />
                {preview ? (
                  <span className="relative block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- R2 public URL / static seed asset / local blob preview */}
                    <img
                      src={preview}
                      alt={`Foto ${typeof initial?.name === "string" ? initial.name : "fasilitas"}`}
                      className="aspect-[16/9] w-full object-cover"
                    />
                    <span className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1 text-xs font-medium whitespace-nowrap text-white">
                      Klik untuk mengubah gambar
                    </span>
                  </span>
                ) : (
                  <span className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
                    <span className="flex size-12 items-center justify-center rounded-full bg-brand-50 text-brand-600">
                      <ImagePlus className="size-6" />
                    </span>
                    <span className="text-sm font-semibold text-gray-800">
                      Pilih gambar
                    </span>
                    <span className="text-xs text-gray-500">
                      Klik untuk mengunggah foto fasilitas
                    </span>
                    <span className="text-xs text-gray-400">
                      PNG atau JPG · Maks {MAX_FACILITY_IMAGE_LABEL}
                    </span>
                  </span>
                )}
              </label>
              {photoError ? (
                <p
                  role="alert"
                  className="mt-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
                >
                  {photoError}
                </p>
              ) : null}
              {isEdit ? (
                <p className="mt-2 text-xs text-gray-400">
                  Kosongkan jika tidak ingin mengganti foto.
                </p>
              ) : null}
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
                  numeric
                  defaultValue={initial?.minCapacity}
                  required
                />
                <Field
                  label="Maksimal Kapasitas"
                  name="maxCapacity"
                  numeric
                  defaultValue={initial?.maxCapacity}
                  required
                />
                <Field
                  label="Jumlah Kamar"
                  name="roomCount"
                  numeric
                  defaultValue={initial?.roomCount ?? 1}
                  required
                />
                <Field
                  label="Jumlah Bed"
                  name="bedCount"
                  numeric
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
                  numeric
                  defaultValue={initial?.minCapacity}
                  required
                />
                <Field
                  label="Maksimal Kapasitas"
                  name="maxCapacity"
                  numeric
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
                  label="Weekday Price"
                  name="weekdayPrice"
                  numeric
                  prefix="Rp"
                  defaultValue={initial?.weekdayPrice}
                  required
                />
                <Field
                  label="Weekend Price"
                  name="weekendPrice"
                  numeric
                  prefix="Rp"
                  defaultValue={initial?.weekendPrice}
                  required
                />
                <Field
                  label="Holiday Price"
                  name="holidayPrice"
                  numeric
                  prefix="Rp"
                  defaultValue={initial?.holidayPrice}
                  required
                />
                <Field
                  label="Extra Bed Price"
                  name="extraBedPrice"
                  numeric
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
                numeric
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
                  numeric
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
  numeric,
  defaultValue,
  required,
  placeholder,
  prefix,
}: {
  label: string;
  name: string;
  numeric?: boolean;
  defaultValue?: string | number | boolean | null;
  required?: boolean;
  placeholder?: string;
  prefix?: string;
}) {
  const value =
    typeof defaultValue === "boolean" ? undefined : (defaultValue ?? undefined);
  const inputClass = cn(
    "h-10 w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400",
    prefix ? "pr-3 pl-2" : "px-3",
  );

  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      {required ? <span className="ml-0.5 text-red-500">*</span> : null}
      <div className="mt-1 flex items-center rounded-lg border border-gray-300 bg-white transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
        {prefix ? (
          <span className="pl-3 text-sm text-gray-400">{prefix}</span>
        ) : null}
        {numeric ? (
          <NumericInput
            name={name}
            required={required}
            placeholder={placeholder}
            defaultValue={value}
            className={inputClass}
          />
        ) : (
          <input
            name={name}
            type="text"
            required={required}
            placeholder={placeholder}
            defaultValue={value}
            className={inputClass}
          />
        )}
      </div>
    </label>
  );
}
