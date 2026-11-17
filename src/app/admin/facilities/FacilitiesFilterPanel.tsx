"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  GraduationCap,
  House,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { FacilityCategory } from "@/features/facilities/service";

export type StatusSelection = "active" | "inactive";
export type SortDirection = "asc" | "desc";
export type SortField =
  | "name"
  | "category"
  | "capacity"
  | "price"
  | "status"
  | "createdAt";

export interface SortState {
  field: SortField | null;
  direction: SortDirection;
}

const CATEGORY_OPTIONS: Array<{
  value: FacilityCategory;
  label: string;
  icon: typeof House;
}> = [
  { value: "homestay", label: "Homestay", icon: House },
  { value: "venue", label: "Meeting Point", icon: MapPin },
  { value: "edutrip", label: "Edutrip", icon: GraduationCap },
];

const STATUS_OPTIONS: Array<{ value: StatusSelection; label: string }> = [
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
];

export const SORT_OPTIONS: Array<{ field: SortField; label: string }> = [
  { field: "name", label: "Nama" },
  { field: "category", label: "Kategori" },
  { field: "capacity", label: "Kapasitas" },
  { field: "price", label: "Harga" },
  { field: "status", label: "Status" },
  { field: "createdAt", label: "Terbaru" },
];

export const PAGE_SIZE_OPTIONS = [10, 15, 20, 25, 30] as const;
export const DEFAULT_PAGE_SIZE = 10;

type PanelTab = "filter" | "sort";

export function FacilitiesFilterPanel({
  open,
  onClose,
  selectedCategories,
  onToggleCategory,
  selectedStatuses,
  onToggleStatus,
  sort,
  onSelectSort,
  onClearAll,
  activeCount,
  pageSize,
  onSelectPageSize,
}: {
  open: boolean;
  onClose: () => void;
  selectedCategories: FacilityCategory[];
  onToggleCategory: (category: FacilityCategory) => void;
  selectedStatuses: StatusSelection[];
  onToggleStatus: (status: StatusSelection) => void;
  sort: SortState;
  onSelectSort: (field: SortField) => void;
  onClearAll: () => void;
  activeCount: number;
  pageSize: number;
  onSelectPageSize: (size: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tab, setTab] = useState<PanelTab>("filter");

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClose();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Filter dan urutan fasilitas"
      className="absolute top-full right-0 z-30 mt-2 w-80 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg"
    >
      <div className="flex gap-1 border-b border-gray-100 p-2">
        <button
          type="button"
          onClick={() => setTab("filter")}
          aria-pressed={tab === "filter"}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "filter"
              ? "bg-brand-50 text-brand-700"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
          )}
        >
          Filter
        </button>
        <button
          type="button"
          onClick={() => setTab("sort")}
          aria-pressed={tab === "sort"}
          className={cn(
            "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            tab === "sort"
              ? "bg-brand-50 text-brand-700"
              : "text-gray-500 hover:bg-gray-50 hover:text-gray-700",
          )}
        >
          Urutkan
        </button>
      </div>

      {tab === "filter" ? (
        <div className="space-y-5 p-4">
          <fieldset>
            <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
              Kategori
            </legend>
            <div className="mt-2 space-y-1">
              {CATEGORY_OPTIONS.map((option) => {
                const Icon = option.icon;
                const checked = selectedCategories.includes(option.value);

                return (
                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => onToggleCategory(option.value)}
                      className="size-4 rounded border-gray-300 accent-brand-700"
                    />
                    <Icon className="size-4 text-gray-400" />
                    {option.label}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
              Status
            </legend>
            <div className="mt-2 space-y-1">
              {STATUS_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(option.value)}
                    onChange={() => onToggleStatus(option.value)}
                    className="size-4 rounded border-gray-300 accent-brand-700"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
              Baris per halaman
            </legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {PAGE_SIZE_OPTIONS.map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => onSelectPageSize(size)}
                  aria-pressed={pageSize === size}
                  className={cn(
                    "rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors",
                    pageSize === size
                      ? "border-brand-600 bg-brand-50 text-brand-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50",
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </fieldset>
        </div>
      ) : (
        <ul className="p-2">
          {SORT_OPTIONS.map((option) => {
            const active = sort.field === option.field;

            return (
              <li key={option.field}>
                <button
                  type="button"
                  onClick={() => onSelectSort(option.field)}
                  aria-pressed={active}
                  title={
                    active
                      ? sort.direction === "asc"
                        ? "Menaik - klik untuk menurun"
                        : "Menurun - klik untuk menaik"
                      : `Urutkan berdasarkan ${option.label.toLowerCase()}`
                  }
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-brand-50 font-medium text-brand-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
                  )}
                >
                  {option.label}
                  {active ? (
                    sort.direction === "asc" ? (
                      <ArrowUp className="size-4" aria-label="Menaik" />
                    ) : (
                      <ArrowDown className="size-4" aria-label="Menurun" />
                    )
                  ) : (
                    <ChevronsUpDown
                      className="size-4 text-gray-300"
                      aria-hidden="true"
                    />
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/60 px-4 py-2.5">
        <span className="text-xs text-gray-500">
          {activeCount > 0
            ? `${activeCount} filter aktif`
            : "Tidak ada filter aktif"}
        </span>
        <button
          type="button"
          onClick={onClearAll}
          disabled={activeCount === 0}
          className="text-xs font-medium text-brand-700 transition-colors hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Bersihkan semua
        </button>
      </div>
    </div>
  );
}
