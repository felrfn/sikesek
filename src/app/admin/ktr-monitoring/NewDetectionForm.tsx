"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
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
    <div>
      <p className="text-sm text-gray-500">
        Untuk insiden yang tidak tertangkap kamera. Deteksi otomatis tetap
        masuk lewat API fog-server.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 space-y-4">
        <label className="block text-sm font-medium text-gray-700">
          Lokasi
          <select
            name="areaId"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          >
            {areas.map((area) => (
              <option key={area.id} value={area.id}>
                {area.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm font-medium text-gray-700">
          confidence (0–1)
          <input
            name="confidence"
            type="number"
            step="0.01"
            min={0}
            max={1}
            defaultValue={1}
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Foto bukti
          <input
            name="evidenceFile"
            type="file"
            accept="image/*"
            required
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
          />
        </label>
        <label className="block text-sm font-medium text-gray-700">
          Catatan
          <textarea
            name="notes"
            rows={3}
            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </label>

        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="flex gap-2 border-t border-gray-100 pt-4">
          <Button type="submit" size="sm" disabled={isSubmitting}>
            {isSubmitting ? "Menyimpan…" : "Simpan"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onDone}>
            Batal
          </Button>
        </div>
      </form>
    </div>
  );
}
