"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Funnel } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import type { PaymentStatus } from "@prisma/client";
import type { PaymentSortField } from "@/features/payments/service";
import { PaymentsSearch } from "./PaymentsSearch";
import {
  PaymentsFilterPanel,
  type PaymentSortState,
} from "./PaymentsFilterPanel";

/**
 * Search + filter trigger for the payments list. Filter state lives in the
 * URL because the server owns filtering/sorting/pagination; the panel only
 * writes search params and lets the server re-render the correct slice.
 */
export function PaymentsToolbar({
  selectedStatuses,
  sort,
  dateActive,
}: {
  selectedStatuses: PaymentStatus[];
  sort: PaymentSortState;
  dateActive: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [filterOpen, setFilterOpen] = useState(false);

  function push(params: URLSearchParams) {
    router.push(`${pathname}?${params.toString()}`);
  }

  function toggleStatus(status: PaymentStatus) {
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

  function selectSort(field: PaymentSortField) {
    const next = new URLSearchParams(searchParams.toString());
    const current = searchParams.get("sort");
    const currentDir = searchParams.get("dir") ?? "desc";
    if (current === field) {
      next.set("dir", currentDir === "asc" ? "desc" : "asc");
    } else {
      next.set("sort", field);
      next.set("dir", field === "createdAt" ? "desc" : "asc");
    }
    next.set("page", "1");
    push(next);
  }

  function clearAll() {
    const next = new URLSearchParams();
    const q = searchParams.get("q");
    if (q) next.set("q", q);
    next.set("page", "1");
    push(next);
  }

  const statusActive =
    selectedStatuses.length > 0 && selectedStatuses.length < 6;
  const sortActive = sort.field !== null;
  const activeCount =
    (statusActive ? 1 : 0) + (sortActive ? 1 : 0);
  const showActive = activeCount > 0 || dateActive;

  return (
    <div className="relative flex flex-wrap items-center gap-2">
      <PaymentsSearch />

      <button
        type="button"
        onClick={() => setFilterOpen(!filterOpen)}
        aria-expanded={filterOpen}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
          filterOpen || showActive
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

      <PaymentsFilterPanel
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        selectedStatuses={selectedStatuses}
        onToggleStatus={toggleStatus}
        sort={sort}
        onSelectSort={selectSort}
        onClearAll={clearAll}
        activeCount={activeCount}
        dateActive={dateActive}
      />
    </div>
  );
}
