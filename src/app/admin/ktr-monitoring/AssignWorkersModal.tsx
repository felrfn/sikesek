"use client";

import { useEffect, useState, useTransition } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { assignKtrWorkers } from "@/features/ktrAssignments/actions";
import { getEligibleWorkers } from "@/features/ktrAssignments/queries";
import type { WorkerWithAvailability } from "@/features/ktrAssignments/service";

const availabilityTone = {
  AVAILABLE: "success",
  UNAVAILABLE: "danger",
  LEAVE: "warning",
  OFF: "neutral",
} as const;

/**
 * The assignment workflow (section 3): one, several, or all eligible
 * workers, with an optional note, and an explicit override warning for
 * anyone marked unavailable rather than silently letting them be picked
 * (section 7).
 */
export function AssignWorkersModal({
  open,
  onClose,
  detectionId,
  onAssigned,
}: {
  open: boolean;
  onClose: () => void;
  detectionId: string;
  onAssigned: () => void;
}) {
  const [workers, setWorkers] = useState<WorkerWithAvailability[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [override, setOverride] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    // One-time reset of this modal's local form state when it (re)opens for
    // a new detection - not a sync from props/state that would loop.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelected(new Set());
    setNote("");
    setOverride(false);
    setError(null);
    getEligibleWorkers().then(setWorkers);
  }, [open]);

  const hasUnavailableSelected = workers?.some(
    (w) => selected.has(w.id) && w.availability !== "AVAILABLE",
  );

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(workers?.map((w) => w.id) ?? []));
  }

  function handleAssign() {
    setError(null);
    startTransition(async () => {
      const result = await assignKtrWorkers({
        detectionId,
        workerIds: Array.from(selected),
        note: note.trim() || undefined,
        overrideUnavailable: override,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      onAssigned();
      onClose();
    });
  }

  return (
    <Modal open={open} onClose={onClose} title="Assign Resolution">
      {!workers ? (
        <p className="text-sm text-gray-400">Loading eligible workers...</p>
      ) : workers.length === 0 ? (
        <p className="text-sm text-gray-400">No active field officers are available to assign.</p>
      ) : (
        <div className="space-y-4">
          <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border border-gray-100 p-2">
            {workers.map((worker) => (
              <label
                key={worker.id}
                className="flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-gray-50"
              >
                <span className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selected.has(worker.id)}
                    onChange={() => toggle(worker.id)}
                  />
                  {worker.name}
                </span>
                <Badge tone={availabilityTone[worker.availability]}>
                  {worker.availability}
                </Badge>
              </label>
            ))}
            <button
              type="button"
              onClick={selectAll}
              className="mt-1 text-xs font-medium text-brand-700 hover:underline"
            >
              Select All
            </button>
          </div>

          <label className="block text-sm font-medium text-gray-700">
            Instruction / Note
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Please check this smoking violation at the north parking area."
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          {hasUnavailableSelected ? (
            <label className="flex items-start gap-2 rounded-md bg-amber-50 p-2 text-xs text-amber-800">
              <input
                type="checkbox"
                checked={override}
                onChange={(e) => setOverride(e.target.checked)}
                className="mt-0.5"
              />
              One or more selected workers are marked unavailable today. Assign anyway.
            </label>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={selected.size === 0 || isPending || (hasUnavailableSelected && !override)}
              onClick={handleAssign}
            >
              {isPending ? "Assigning..." : "Assign"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
