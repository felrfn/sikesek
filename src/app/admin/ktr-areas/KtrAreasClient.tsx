"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import {
  createKtrArea,
  deleteKtrArea,
  setKtrAreaActive,
  updateKtrArea,
} from "@/features/ktrAreas/actions";
import type { KtrAreaRow, OfficerOption } from "@/features/ktrAreas/types";

export function KtrAreasClient({
  areas,
  officers,
}: {
  areas: KtrAreaRow[];
  officers: OfficerOption[];
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<KtrAreaRow | "new" | null>(null);
  const [createdAreaId, setCreatedAreaId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyAreaId(areaId: string) {
    try {
      await navigator.clipboard.writeText(areaId);
      setCopiedId(areaId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Clipboard can be blocked by the browser; the id is still visible to
      // select manually, so this is not worth surfacing as an error.
    }
  }

  if (editing) {
    return (
      <KtrAreaForm
        area={editing === "new" ? null : editing}
        officers={officers}
        onCancel={() => setEditing(null)}
        onSaved={(areaId) => {
          setEditing(null);
          setActionError(null);
          if (areaId) setCreatedAreaId(areaId);
          router.refresh();
        }}
      />
    );
  }

  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button
          size="sm"
          onClick={() => {
            setCreatedAreaId(null);
            setEditing("new");
          }}
        >
          <Plus className="size-4" />
          Add Area
        </Button>
      </div>

      {createdAreaId ? (
        <Card className="mb-4 border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Area created. Give this id to the AI pipeline (or let it fetch it
            from <code className="rounded bg-white/70 px-1">GET /api/ktr/areas</code>):
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="rounded bg-white px-2 py-1 font-mono text-xs text-gray-800">
              {createdAreaId}
            </code>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void copyAreaId(createdAreaId)}
            >
              {copiedId === createdAreaId ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
              {copiedId === createdAreaId ? "Copied" : "Copy"}
            </Button>
            <button
              type="button"
              className="text-sm text-green-800 hover:underline"
              onClick={() => setCreatedAreaId(null)}
            >
              Dismiss
            </button>
          </div>
        </Card>
      ) : null}

      {actionError ? (
        <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {actionError}
        </p>
      ) : null}

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-4 py-3">Area</th>
              <th className="px-4 py-3">Stream</th>
              <th className="px-4 py-3">Default officer</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Detections</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {areas.map((area) => (
              <tr key={area.id}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{area.name}</p>
                  <p className="text-xs text-gray-500">
                    {area.locationDescription ?? "No location description"}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyAreaId(area.id)}
                    title={`Copy area id: ${area.id}`}
                    className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] text-gray-400 hover:text-brand-700"
                  >
                    {copiedId === area.id ? (
                      <Check className="size-3" />
                    ) : (
                      <Copy className="size-3" />
                    )}
                    {area.id}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <span
                    className="block max-w-56 truncate font-mono text-xs text-gray-600"
                    title={area.streamUrl ?? undefined}
                  >
                    {area.streamUrl ?? "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {area.assignedEmployee?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <Badge tone={area.isActive ? "success" : "neutral"}>
                    {area.isActive ? "Active" : "Inactive"}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-gray-700">
                  {area.detectionCount}
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCreatedAreaId(null);
                        setEditing(area);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busyId === area.id}
                      onClick={async () => {
                        setBusyId(area.id);
                        setActionError(null);
                        const result = await setKtrAreaActive(
                          area.id,
                          !area.isActive,
                        );
                        setBusyId(null);
                        if (result.error) setActionError(result.error);
                        else router.refresh();
                      }}
                    >
                      {area.isActive ? "Deactivate" : "Activate"}
                    </Button>
                    <button
                      type="button"
                      title="Delete area"
                      disabled={busyId === area.id}
                      onClick={async () => {
                        if (
                          !confirm(
                            `Delete area "${area.name}"? Areas with detection records can only be deactivated.`,
                          )
                        ) {
                          return;
                        }
                        setBusyId(area.id);
                        setActionError(null);
                        const result = await deleteKtrArea(area.id);
                        setBusyId(null);
                        if (result.error) setActionError(result.error);
                        else router.refresh();
                      }}
                      className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {areas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  No monitored areas configured yet. Add the first camera above.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function KtrAreaForm({
  area,
  officers,
  onSaved,
  onCancel,
}: {
  area: KtrAreaRow | null;
  officers: OfficerOption[];
  onSaved: (areaId: string | null) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const result = area
      ? await updateKtrArea(area.id, formData)
      : await createKtrArea(formData);

    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved(area ? null : result.areaId ?? "");
  }

  return (
    <Card className="max-w-xl p-6">
      <h2 className="font-semibold text-gray-900">
        {area ? "Edit Monitored Area" : "Add Monitored Area"}
      </h2>
      <p className="mt-1 text-sm text-gray-500">
        One row per camera/zone. The AI pipeline reports detections against
        this area&apos;s id.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Area name
          <input
            name="name"
            required
            maxLength={120}
            placeholder="e.g. Gazebo 01"
            defaultValue={area?.name}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Location description
          <input
            name="locationDescription"
            maxLength={500}
            placeholder="e.g. North side of the main pool"
            defaultValue={area?.locationDescription ?? ""}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Camera stream URL (optional)
          <input
            name="streamUrl"
            maxLength={2048}
            placeholder="rtsp://camera.local/stream"
            defaultValue={area?.streamUrl ?? ""}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 font-mono text-sm"
          />
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Only a reference for the AI pipeline. It may manage the camera
            stream itself, so admin does not need to fill this in.
          </span>
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Default officer
          <select
            name="assignedEmployeeId"
            defaultValue={area?.assignedEmployee?.id ?? ""}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">— None —</option>
            {officers.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-gray-500">
            Informational only - it does not auto-assign detections. Tasks are
            still assigned from the KTR monitoring page.
          </span>
        </label>

        <label className="block text-sm font-medium text-gray-700">
          Status
          <select
            name="isActive"
            defaultValue={area ? String(area.isActive) : "true"}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="true">Active - accepts detections</option>
            <option value="false">Inactive - rejects detections</option>
          </select>
        </label>

        {area ? (
          <div className="rounded-md bg-gray-50 px-3 py-2">
            <p className="text-xs text-gray-500">Area id</p>
            <code className="font-mono text-xs text-gray-800">{area.id}</code>
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
