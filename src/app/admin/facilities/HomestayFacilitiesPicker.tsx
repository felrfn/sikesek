"use client";

import { useEffect, useState } from "react";
import { getAmenitiesList, getHomestayFacilitySelections } from "@/features/facilities/queries";
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
export function HomestayFacilitiesPicker({ homestayId }: { homestayId?: string }) {
  const [amenities, setAmenities] = useState<Facility[] | null>(null);
  const [selections, setSelections] = useState<Selection[]>([]);

  useEffect(() => {
    getAmenitiesList().then(setAmenities);
    if (homestayId) {
      getHomestayFacilitySelections(homestayId).then((rows) =>
        setSelections(rows.map((r) => ({ facilityId: r.facilityId, descriptionOverride: r.descriptionOverride ?? "" }))),
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
      prev.map((s) => (s.facilityId === facilityId ? { ...s, descriptionOverride: value } : s)),
    );
  }

  if (!amenities) {
    return <p className="text-sm text-gray-400">Loading facilities...</p>;
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700">Facilities</p>
      <div className="space-y-1 rounded-md border border-gray-200 p-2">
        {amenities.map((amenity) => {
          const selection = selections.find((s) => s.facilityId === amenity.id);
          return (
            <div key={amenity.id} className="rounded-md px-2 py-1 hover:bg-gray-50">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={!!selection}
                  onChange={() => toggle(amenity.id)}
                />
                {amenity.name}
              </label>
              {selection ? (
                <input
                  value={selection.descriptionOverride}
                  onChange={(e) => setOverride(amenity.id, e.target.value)}
                  placeholder={amenity.description ?? "Description override (optional)"}
                  className="mt-1 block w-full rounded-md border border-gray-200 px-2 py-1 text-xs"
                />
              ) : null}
            </div>
          );
        })}
        {amenities.length === 0 ? (
          <p className="p-2 text-xs text-gray-400">
            No active facilities yet - add some under Manage Amenities.
          </p>
        ) : null}
      </div>
      <input type="hidden" name="facilitySelectionsJson" value={JSON.stringify(selections)} />
    </div>
  );
}
