"use client";

import { useState } from "react";
import type { FacilityCategory } from "@/features/facilities/service";
import { FacilityForm } from "../FacilityForm";

export function NewFacilityClient() {
  const [category, setCategory] = useState<FacilityCategory>("homestay");

  return (
    <div className="space-y-4">
      <label className="block max-w-xl text-sm font-medium text-gray-700">
        Category
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as FacilityCategory)}
          className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        >
          <option value="homestay">Homestay</option>
          <option value="venue">Meeting Point</option>
          <option value="edutrip">Edutrip</option>
        </select>
      </label>

      <FacilityForm key={category} category={category} mode="create" />
    </div>
  );
}
