"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { createManualDetection } from "@/features/violations/actions";
import type { MonitoredArea } from "@prisma/client";

export function NewDetectionForm({
  areas,
  onDone,
}: {
  areas: MonitoredArea[];
  onDone: () => void;
}) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const result = await createManualDetection(new FormData(event.currentTarget));
    setIsSubmitting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onDone();
    router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold text-gray-900">Log a manual incident</h2>
      <p className="mt-1 text-sm text-gray-500">
        For incidents a camera didn&apos;t catch. Automated detections still
        arrive via the fog-server API.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-3">
        <label className="block text-sm font-medium text-gray-700">
          Location
          <select
            name="areaId"
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Confidence (0-1)
          <input
            name="confidence"
            type="number"
            step="0.01"
            min={0}
            max={1}
            defaultValue={1}
            required
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Evidence photo
          <input
            name="evidenceFile"
            type="file"
            accept="image/*"
            required
            className="mt-1 block w-full text-sm"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Notes
          <textarea
            name="notes"
            rows={2}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex gap-2 pt-2">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDone}>
            Cancel
          </Button>
        </div>
      </form>
    </Card>
  );
}
