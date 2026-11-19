"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import {
  PAYMENT_STATUS_META,
  PAYMENT_STATUS_OPTIONS,
} from "@/lib/utils/paymentStatus";
import type { PaymentStatus } from "@prisma/client";
import type { PaymentSortField } from "@/features/payments/service";

export interface PaymentSortState {
  field: PaymentSortField | null;
  dir: "asc" | "desc";
}

export const PAYMENT_SORT_OPTIONS: Array<{
  field: PaymentSortField;
  label: string;
}> = [
  { field: "createdAt", label: "Tanggal" },
  { field: "invoiceNumber", label: "Invoice" },
  { field: "totalAmount", label: "Nominal" },
  { field: "customerName", label: "Pelanggan" },
  { field: "paymentStatus", label: "Status" },
];

type PanelTab = "filter" | "sort";

export function PaymentsFilterPanel({
  open,
  onClose,
  selectedStatuses,
  onToggleStatus,
  sort,
  onSelectSort,
  onClearAll,
  activeCount,
  dateActive,
}: {
  open: boolean;
  onClose: () => void;
  selectedStatuses: PaymentStatus[];
  onToggleStatus: (status: PaymentStatus) => void;
  sort: PaymentSortState;
  onSelectSort: (field: PaymentSortField) => void;
  onClearAll: () => void;
  activeCount: number;
  dateActive: boolean;
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
      aria-label="Filter dan urutan transaksi"
      className="absolute top-full left-0 z-30 mt-2 max-h-[75vh] w-96 max-w-[calc(100vw-4rem)] overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-lg"
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
              Status pembayaran
            </legend>
            <div className="mt-2 space-y-1">
              {PAYMENT_STATUS_OPTIONS.map((status) => (
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
                  {PAYMENT_STATUS_META[status].label}
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
                label="Transaksi"
                onApplied={onClose}
              />
            </div>
          </fieldset>
        </div>
      ) : (
        <ul className="p-2">
          {PAYMENT_SORT_OPTIONS.map((option) => {
            const active = sort.field === option.field;
            return (
              <li key={option.field}>
                <button
                  type="button"
                  onClick={() => onSelectSort(option.field)}
                  aria-pressed={active}
                  title={
                    active
                      ? sort.dir === "asc"
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
                    sort.dir === "asc" ? (
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
            : dateActive
              ? "Filter tanggal aktif"
              : "Tidak ada filter aktif"}
        </span>
        <button
          type="button"
          onClick={onClearAll}
          disabled={activeCount === 0 && !dateActive}
          className="text-xs font-medium text-brand-700 transition-colors hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Bersihkan semua
        </button>
      </div>
    </div>
  );
}
