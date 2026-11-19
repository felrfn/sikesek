"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Funnel } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import type { DetectionStatus } from "@prisma/client";

export const DETECTION_STATUS_OPTIONS: DetectionStatus[] = [
  "DETECTED",
  "NOTIFIED",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "FALSE_POSITIVE",
  "DISMISSED",
];

function statusLabel(status: string) {
  return status
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

/**
 * Filter popover for the KTR log: multi-select status + date range. Both are
 * written to the URL so the server re-fetches the filtered page.
 */
export function KtrFilterPanel({
  selectedStatuses,
  dateActive,
}: {
  selectedStatuses: DetectionStatus[];
  dateActive: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  function push(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleStatus(status: DetectionStatus) {
    const next = new URLSearchParams(searchParams.toString());
    const selected = new Set(selectedStatuses);
    if (selected.has(status)) selected.delete(status);
    else selected.add(status);
    next.delete("status");
    if (selected.size === 0) next.delete("statuses");
    else next.set("statuses", [...selected].join(","));
    next.set("page", "1");
    push(next);
  }

  function clearAll() {
    const next = new URLSearchParams();
    const view = searchParams.get("view");
    if (view) next.set("view", view);
    next.set("page", "1");
    push(next);
  }

  const activeCount =
    selectedStatuses.length > 0 &&
    selectedStatuses.length < DETECTION_STATUS_OPTIONS.length
      ? 1
      : 0;
  const showActive = activeCount > 0 || dateActive;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
          open || showActive
            ? "border-brand-600 bg-brand-50 text-brand-700"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
        )}
      >
        <Funnel className="size-4" />
        Filter
        {showActive ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-700 text-[11px] font-semibold text-white">
            {activeCount + (dateActive ? 1 : 0)}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter catatan KTR"
          className="absolute top-full left-0 z-30 mt-2 max-h-[75vh] w-96 max-w-[calc(100vw-4rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          <div className="space-y-5 p-4">
            <fieldset>
              <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                Status
              </legend>
              <div className="mt-2 space-y-1">
                {DETECTION_STATUS_OPTIONS.map((status) => (
                  <label
                    key={status}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={selectedStatuses.includes(status)}
                      onChange={() => toggleStatus(status)}
                      className="size-4 rounded border-gray-300 accent-brand-700"
                    />
                    {statusLabel(status)}
                  </label>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                Rentang tanggal
              </legend>
              <div className="mt-2 rounded-lg border border-gray-100 bg-gray-50/40 p-3">
                <DateRangeFilter
                  label="Deteksi"
                  onApplied={() => setOpen(false)}
                />
              </div>
            </fieldset>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
            <span className="text-xs text-gray-500">
              {showActive ? "Filter aktif" : "Tidak ada filter aktif"}
            </span>
            <button
              type="button"
              onClick={clearAll}
              disabled={!showActive}
              className="text-xs font-medium text-brand-700 transition-colors hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Bersihkan semua
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
