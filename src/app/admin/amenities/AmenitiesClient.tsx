"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Plus, Power } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Modal } from "@/components/ui/Modal";
import { FacilityIcon, facilityIconMap } from "@/features/catalog/facilityIcons";
import { createAmenity, toggleAmenityActive, updateAmenity } from "@/features/facilities/amenityActions";
import type { Facility } from "@prisma/client";

export function AmenitiesClient({ amenities }: { amenities: Facility[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<Facility | "new" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result =
        editing === "new"
          ? await createAmenity(formData)
          : await updateAmenity((editing as Facility).id, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setEditing(null);
      router.refresh();
    });
  }

  const editingFacility = editing !== "new" ? editing : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b border-gray-100 p-4">
        <h2 className="font-semibold text-gray-900">Amenities</h2>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-4" />
          Add Facility
        </Button>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-400">
          <tr>
            <th className="px-4 py-3">Icon</th>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Description</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {amenities.map((a) => (
            <tr key={a.id}>
              <td className="px-4 py-3">
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- R2 public URL
                  <img src={a.imageUrl} alt={a.name} className="size-8 rounded object-cover" />
                ) : (
                  <FacilityIcon iconName={a.iconName} />
                )}
              </td>
              <td className="px-4 py-3 font-medium text-gray-900">{a.name}</td>
              <td className="px-4 py-3 text-gray-500">{a.description ?? "-"}</td>
              <td className="px-4 py-3">
                <Badge tone={a.isActive ? "success" : "neutral"}>
                  {a.isActive ? "Active" : "Inactive"}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="outline" onClick={() => setEditing(a)}>
                    Edit
                  </Button>
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(() => toggleAmenityActive(a.id, !a.isActive))
                    }
                    disabled={isPending}
                    className="rounded p-1.5 text-gray-400 hover:bg-gray-100"
                    title={a.isActive ? "Deactivate" : "Activate"}
                  >
                    <Power className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {amenities.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                No facilities yet.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "Add Facility" : `Edit ${editingFacility?.name ?? ""}`}
      >
        <form onSubmit={handleSubmit} className="space-y-3 text-sm">
          <label className="block font-medium text-gray-700">
            Name
            <input
              name="name"
              defaultValue={editingFacility?.name}
              required
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block font-medium text-gray-700">
            Description
            <textarea
              name="description"
              defaultValue={editingFacility?.description ?? ""}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </label>
          <label className="block font-medium text-gray-700">
            Icon
            <select
              name="iconName"
              defaultValue={editingFacility?.iconName ?? ""}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2"
            >
              <option value="">None (use image)</option>
              {Object.keys(facilityIconMap).map((icon) => (
                <option key={icon} value={icon}>
                  {icon}
                </option>
              ))}
            </select>
          </label>
          <label className="block font-medium text-gray-700">
            Image
            <input
              name="image"
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-sm"
            />
          </label>
          <label className="flex items-center gap-2 font-medium text-gray-700">
            <input
              type="checkbox"
              name="isActive"
              value="true"
              defaultChecked={editingFacility?.isActive ?? true}
            />
            Active
          </label>

          {error ? <p className="text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button type="submit" size="sm" disabled={isPending}>
              {isPending ? "Saving..." : "Save"}
            </Button>
          </div>
        </form>
      </Modal>
    </Card>
  );
}
