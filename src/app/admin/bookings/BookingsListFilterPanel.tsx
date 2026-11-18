"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { ALL_BOOKING_STATUSES } from "@/features/bookings/schedule";
import {
  BOOKING_TYPES,
  BOOKING_TYPE_META,
  PAYMENT_STATUS_META,
  bookingStatusLabel,
} from "@/features/bookings/display";
import type { BookingType } from "@/features/bookings/service";

export type BookingSortDirection = "asc" | "desc";
export type BookingSortField =
  | "date"
  | "invoice"
  | "visitor"
  | "facility"
  | "status"
  | "payment"
  | "createdAt";

export interface BookingSortState {
  field: BookingSortField | null;
  direction: BookingSortDirection;
}

export const BOOKING_SORT_OPTIONS: Array<{
  field: BookingSortField;
  label: string;
}> = [
  { field: "date", label: "Tanggal" },
  { field: "createdAt", label: "Terbaru" },
  { field: "invoice", label: "Invoice" },
  { field: "visitor", label: "Tamu" },
  { field: "facility", label: "Fasilitas" },
  { field: "status", label: "Status" },
  { field: "payment", label: "Pembayaran" },
];

export const BOOKING_PAGE_SIZE_OPTIONS = [10, 15, 20, 25, 30] as const;
export const DEFAULT_BOOKING_PAGE_SIZE = 10;

const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_META);

type PanelTab = "filter" | "sort";

export function BookingsListFilterPanel({
  open,
  onClose,
  selectedTypes,
  onToggleType,
  selectedStatuses,
  onToggleStatus,
  selectedPayments,
  onTogglePayment,
  sort,
  onSelectSort,
  onClearAll,
  activeCount,
  pageSize,
  onSelectPageSize,
}: {
  open: boolean;
  onClose: () => void;
  selectedTypes: BookingType[];
  onToggleType: (type: BookingType) => void;
  selectedStatuses: string[];
  onToggleStatus: (status: string) => void;
  selectedPayments: string[];
  onTogglePayment: (status: string) => void;
  sort: BookingSortState;
  onSelectSort: (field: BookingSortField) => void;
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
      aria-label="Filter dan urutan reservasi"
      className="absolute top-full right-0 z-30 mt-2 max-h-[70vh] w-80 max-w-[calc(100vw-4rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
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
                      checked={selectedTypes.includes(type)}
                      onChange={() => onToggleType(type)}
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
              Status reservasi
            </legend>
            <div className="mt-2 space-y-1">
              {ALL_BOOKING_STATUSES.map((status) => (
                <label
                  key={status}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedStatuses.includes(status)}
                    onChange={() => onToggleStatus(status)}
                    className="size-4 rounded border-gray-300 accent-brand-700"
                  />
                  {bookingStatusLabel(status)}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
              Status pembayaran
            </legend>
            <div className="mt-2 space-y-1">
              {PAYMENT_STATUSES.map((status) => (
                <label
                  key={status}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedPayments.includes(status)}
                    onChange={() => onTogglePayment(status)}
                    className="size-4 rounded border-gray-300 accent-brand-700"
                  />
                  {PAYMENT_STATUS_META[status]?.label ?? status}
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="text-xs font-medium tracking-wide text-gray-400 uppercase">
              Baris per halaman
            </legend>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {BOOKING_PAGE_SIZE_OPTIONS.map((size) => (
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
          {BOOKING_SORT_OPTIONS.map((option) => {
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
