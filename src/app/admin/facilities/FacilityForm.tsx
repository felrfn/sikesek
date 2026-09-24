"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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

const categoryLabels: Record<FacilityCategory, string> = {
  homestay: "Homestay",
  venue: "Meeting Point",
  edutrip: "Edutrip",
};

export function FacilityForm({
  category,
  mode,
  facilityId,
  initial,
}: FacilityFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <Card className="max-w-xl p-6">
      <h2 className="font-semibold text-gray-900">
        {mode === "create" ? "Add" : "Edit"} {categoryLabels[category]}
      </h2>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <Field label="Name" name="name" defaultValue={initial?.name} required />

        {category === "homestay" || category === "venue" ? (
          <label className="block text-sm font-medium text-gray-700">
            Description
            <textarea
              name="description"
              defaultValue={typeof initial?.description === "string" ? initial.description : ""}
              rows={3}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
        ) : null}

        {category === "homestay" || category === "venue" ? (
          <label className="block text-sm font-medium text-gray-700">
            Image
            <input name="image" type="file" accept="image/*" className="mt-1 block w-full text-sm" />
            {typeof initial?.imageUrl === "string" && initial.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- R2 public URL / static seed asset
              <img src={initial.imageUrl} alt="Current" className="mt-2 h-24 w-full rounded-md object-cover" />
            ) : null}
          </label>
        ) : null}

        {category === "homestay" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Min Capacity"
                name="minCapacity"
                type="number"
                defaultValue={initial?.minCapacity}
                required
              />
              <Field
                label="Max Capacity"
                name="maxCapacity"
                type="number"
                defaultValue={initial?.maxCapacity}
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Number of bedrooms"
                name="roomCount"
                type="number"
                defaultValue={initial?.roomCount ?? 1}
                required
              />
              <Field
                label="Number of beds"
                name="bedCount"
                type="number"
                defaultValue={initial?.bedCount ?? 1}
                required
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <Field
                label="Weekday Price"
                name="weekdayPrice"
                type="number"
                defaultValue={initial?.weekdayPrice}
                required
              />
              <Field
                label="Weekend Price"
                name="weekendPrice"
                type="number"
                defaultValue={initial?.weekendPrice}
                required
              />
              <Field
                label="Holiday Price"
                name="holidayPrice"
                type="number"
                defaultValue={initial?.holidayPrice}
                required
              />
            </div>
            <Field
              label="Extra Bed Price"
              name="extraBedPrice"
              type="number"
              defaultValue={initial?.extraBedPrice ?? 0}
            />
            <HomestayFacilitiesPicker homestayId={facilityId} />
          </>
        ) : null}

        {category === "venue" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field
                label="Min Capacity"
                name="minCapacity"
                type="number"
                defaultValue={initial?.minCapacity}
                required
              />
              <Field
                label="Max Capacity"
                name="maxCapacity"
                type="number"
                defaultValue={initial?.maxCapacity}
                required
              />
            </div>
            <Field
              label="Price per Hour"
              name="pricePerHour"
              type="number"
              defaultValue={initial?.pricePerHour}
              required
            />
          </>
        ) : null}

        {category === "edutrip" ? (
          <>
            <Field
              label="Price per Pax"
              name="pricePerPax"
              type="number"
              defaultValue={initial?.pricePerPax}
              required
            />
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                name="isPopular"
                value="true"
                defaultChecked={Boolean(initial?.isPopular)}
              />
              Mark as popular
            </label>
            <EdutripIncludedItemsPicker packageId={facilityId} />
          </>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/facilities")}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | number | boolean | null;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={
          typeof defaultValue === "boolean" ? undefined : (defaultValue ?? undefined)
        }
        className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
      />
    </label>
  );
}
