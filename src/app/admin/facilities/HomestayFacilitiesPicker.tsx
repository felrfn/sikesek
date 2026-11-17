"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  getAmenitiesList,
  getHomestayFacilitySelections,
} from "@/features/facilities/queries";
import type { Facility } from "@prisma/client";

interface Selection {
  facilityId: string;
  descriptionOverride: string;
}

/**
 * Lets the admin pick which amenities a homestay has, with an optional
 * per-homestay description override (section 26/27) - e.g. the shared "TV"
 * amenity becomes "Smart TV 43 inch dengan Netflix" for just this homestay.
 * Serializes its selections into a hidden `facilitySelectionsJson` field so
 * the parent <form>'s normal FormData submit picks it up automatically.
 */
export function HomestayFacilitiesPicker({
  homestayId,
}: {
  homestayId?: string;
}) {
  const [amenities, setAmenities] = useState<Facility[] | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);
  const [query, setQuery] = useState("");

  useEffect(() => {
    getAmenitiesList().then(setAmenities);
    if (homestayId) {
      getHomestayFacilitySelections(homestayId).then((rows) =>
        setSelections(
          rows.map((r) => ({
            facilityId: r.facilityId,
            descriptionOverride: r.descriptionOverride ?? "",
          })),
        ),
      );
    }
  }, [homestayId]);

  function toggle(facilityId: string) {
    setSelections((prev) =>
      prev.some((s) => s.facilityId === facilityId)
        ? prev.filter((s) => s.facilityId !== facilityId)
        : [...prev, { facilityId, descriptionOverride: "" }],
    );
  }

  function setOverride(facilityId: string, value: string) {
    setSelections((prev) =>
      prev.map((s) =>
        s.facilityId === facilityId
          ? { ...s, descriptionOverride: value }
          : s,
      ),
    );
  }

  const filtered = useMemo(() => {
    if (!amenities) return [];
    const term = query.trim().toLowerCase();
    if (!term) return amenities;
    return amenities.filter((amenity) =>
      amenity.name.toLowerCase().includes(term),
    );
  }, [amenities, query]);

  if (!amenities) {
    return <p className="text-sm text-gray-400">Memuat amenitas…</p>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50/60 px-3 py-2">
        <span className="text-xs font-medium text-gray-500">
          {selections.length} dipilih
        </span>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari amenitas…"
            className="h-8 w-44 rounded-md border border-gray-200 bg-white pr-2.5 pl-8 text-xs outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>
      </div>

      <div className="max-h-72 divide-y divide-gray-100 overflow-y-auto">
        {filtered.map((amenity) => {
          const selection = selections.find(
            (s) => s.facilityId === amenity.id,
          );

          return (
            <div key={amenity.id} className="px-3 py-2.5">
              <label className="flex items-start gap-2.5 text-sm">
                <input
                  type="checkbox"
                  checked={!!selection}
                  onChange={() => toggle(amenity.id)}
                  className="mt-0.5 size-4 rounded border-gray-300 accent-brand-700"
                />
                <span>
                  <span className="font-medium text-gray-800">
                    {amenity.name}
                  </span>
                  {amenity.description ? (
                    <span className="mt-0.5 block text-xs text-gray-500">
                      {amenity.description}
                    </span>
                  ) : null}
                </span>
              </label>

              {selection ? (
                <input
                  value={selection.descriptionOverride}
                  onChange={(event) =>
                    setOverride(amenity.id, event.target.value)
                  }
                  placeholder={
                    amenity.description ??
                    "Deskripsi khusus untuk homestay ini (opsional)"
                  }
                  className="mt-2 ml-[1.625rem] block w-[calc(100%-1.625rem)] rounded-md border border-gray-200 px-2.5 py-1.5 text-xs outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
                />
              ) : null}
            </div>
          );
        })}

        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-gray-400">
            {amenities.length === 0
              ? "Belum ada amenitas aktif. Tambahkan lewat Kelola Amenitas."
              : "Tidak ada amenitas yang cocok dengan pencarian."}
          </p>
        ) : null}
      </div>

      <input
        type="hidden"
        name="facilitySelectionsJson"
        value={JSON.stringify(selections)}
      />
    </div>
  );
}
