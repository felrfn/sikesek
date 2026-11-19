"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Funnel } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ALL_BOOKING_STATUSES } from "@/features/bookings/schedule";
import {
  BOOKING_TYPES,
  BOOKING_TYPE_META,
  bookingStatusLabel,
} from "@/features/bookings/display";
import type { ScheduleBookingType } from "@/features/bookings/schedule";

/**
 * Chart-mode filter: which of the three Gantt sections are shown (Tipe) and
 * which booking statuses are drawn as bars (Status). Writes straight to the
 * URL so the server re-fetches each visible section and links stay shareable.
 */
export function BookingsChartFilter({
  visibleTypes,
  statuses,
  showInactive,
}: {
  visibleTypes: ScheduleBookingType[];
  statuses: string[];
  showInactive: boolean;
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
  }, [open ]);

  function update(next: URLSearchParams) {
    router.push(`${pathname}?${next.toString()}`);
  }

  function toggleType(type: ScheduleBookingType) {
    const params = new URLSearchParams(searchParams.toString());
    const selected = new Set(params.get("types")?.split(",").filter(Boolean) ?? BOOKING_TYPES);
    if (selected.has(type)) selected.delete(type);
    else selected.add(type);
    if (selected.size === 0 || selected.size === BOOKING_TYPES.length) {
      params.delete("types");
    } else {
      params.set(
        "types",
        BOOKING_TYPES.filter((candidate) => selected.has(candidate)).join(","),
      );
    }
    update(params);
  }

  function toggleStatus(status: string) {
    const params = new URLSearchParams(searchParams.toString());
    const selected = new Set(
      params.get("statuses")?.split(",").filter(Boolean) ?? statuses,
    );
    if (selected.has(status)) selected.delete(status);
    else selected.add(status);
    const ordered = ALL_BOOKING_STATUSES.filter((candidate) =>
      selected.has(candidate),
    );
    if (ordered.length === 0 || ordered.length === ALL_BOOKING_STATUSES.length) {
      params.delete("statuses");
    } else {
      params.set("statuses", ordered.join(","));
    }
    update(params);
  }

  function clearAll() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("types");
    params.delete("statuses");
    params.delete("showInactive");
    update(params);
  }

  function toggleInactive(checked: boolean) {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) params.set("showInactive", "1");
    else params.delete("showInactive");
    params.set("page", "1");
    update(params);
  }

  const typeActive =
    visibleTypes.length > 0 && visibleTypes.length < BOOKING_TYPES.length;
  const statusActive =
    statuses.length > 0 && statuses.length < ALL_BOOKING_STATUSES.length;
  const activeCount =
    (typeActive ? 1 : 0) + (statusActive ? 1 : 0) + (showInactive ? 1 : 0);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
          open || activeCount > 0
            ? "border-brand-600 bg-brand-50 text-brand-700"
            : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
        )}
      >
        <Funnel className="size-4" />
        Filter
        {activeCount > 0 ? (
          <span className="flex size-5 items-center justify-center rounded-full bg-brand-700 text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          role="dialog"
          aria-label="Filter grafik reservasi"
          // left-aligned: the trigger sits at the content's left edge, so a
          // right-aligned panel would slide underneath the sidebar.
          className="absolute top-full left-0 z-30 mt-2 max-h-[70vh] w-80 max-w-[calc(100vw-4rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
        >
          <div className="space-y-5 p-4">
            <fieldset>
              <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                Tipe
              </legend>
              <div className="mt-2 space-y-1">
                {BOOKING_TYPES.map((type) => {
                  const meta = BOOKING_TYPE_META[type];
                  const Icon = meta.icon;
                  return (
                    <label
                      key={type}
                      className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                    >
                      <input
                        type="checkbox"
                        checked={visibleTypes.includes(type)}
                        onChange={() => toggleType(type)}
                        className="size-4 rounded border-gray-300 accent-brand-700"
                      />
                      <Icon className="size-4 text-gray-400" />
                      {meta.label}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                Fasilitas
              </legend>
              <label className="mt-2 flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={showInactive}
                  onChange={(event) => toggleInactive(event.target.checked)}
                  className="size-4 rounded border-gray-300 accent-brand-700"
                />
                Tampilkan fasilitas nonaktif
              </label>
              <p className="mt-1 px-2 text-xs text-gray-500">
                Default hanya fasilitas aktif yang ditampilkan.
              </p>
            </fieldset>

            <fieldset>
              <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
                Status
              </legend>
              <div className="mt-2 space-y-1">
                {ALL_BOOKING_STATUSES.map((status) => (
                  <label
                    key={status}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={statuses.includes(status)}
                      onChange={() => toggleStatus(status)}
                      className="size-4 rounded border-gray-300 accent-brand-700"
                    />
                    {bookingStatusLabel(status)}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
            <span className="text-xs text-gray-500">
              {activeCount > 0
                ? `${activeCount} filter aktif`
                : "Tidak ada filter aktif"}
            </span>
            <button
              type="button"
              onClick={clearAll}
              disabled={activeCount === 0}
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
