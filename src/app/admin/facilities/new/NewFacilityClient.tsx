"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, GraduationCap, House, MapPin } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import type { FacilityCategory } from "@/features/facilities/service";
import { FacilityForm } from "../FacilityForm";

const CATEGORY_OPTIONS = [
  {
    value: "homestay",
    label: "Homestay",
    description: "Properti menginap",
    icon: House,
  },
  {
    value: "venue",
    label: "Meeting Point",
    description: "Ruang atau titik pertemuan",
    icon: MapPin,
  },
  {
    value: "edutrip",
    label: "Edutrip",
    description: "Paket kegiatan edukasi",
    icon: GraduationCap,
  },
] as const;

export function NewFacilityClient() {
  const [category, setCategory] = useState<FacilityCategory>("homestay");

  return (
    <div>
      <div>
        <Link
          href="/admin/facilities"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 transition-colors hover:text-brand-700"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Fasilitas
        </Link>
        <h1 className="mt-3 text-xl font-semibold text-gray-900">
          Tambah Fasilitas
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Lengkapi data fasilitas baru yang akan tampil di katalog publik.
        </p>
      </div>

      <Card className="mt-5 p-4">
        <p className="text-xs font-medium tracking-wide text-gray-400 uppercase">
          Tipe Fasilitas
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {CATEGORY_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = category === option.value;

            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setCategory(option.value)}
                aria-pressed={active}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                  active
                    ? "border-brand-600 bg-brand-50 text-brand-800"
                    : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-md",
                    active ? "bg-brand-700 text-white" : "bg-gray-100 text-gray-500",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-semibold">
                    {option.label}
                  </span>
                  <span
                    className={cn(
                      "mt-0.5 block text-xs",
                      active ? "text-brand-700" : "text-gray-500",
                    )}
                  >
                    {option.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <FacilityForm key={category} category={category} mode="create" />
    </div>
  );
}
