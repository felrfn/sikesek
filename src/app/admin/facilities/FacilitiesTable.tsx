"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Funnel,
  GraduationCap,
  House,
  MapPin,
  Search,
  SearchX,
  Trash2,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import {
  deleteFacility,
  toggleFacilityActive,
} from "@/features/facilities/actions";
import type {
  FacilityCategory,
  UnifiedFacilityRow,
} from "@/features/facilities/service";
import {
  DEFAULT_PAGE_SIZE,
  FacilitiesFilterPanel,
  type SortField,
  type SortState,
  type StatusSelection,
} from "./FacilitiesFilterPanel";
import { ClientPagination } from "@/components/admin/ClientPagination";

const CATEGORY_META = {
  homestay: {
    label: "Homestay",
    icon: House,
    badge: "bg-brand-50 text-brand-700",
  },
  venue: {
    label: "Meeting Point",
    icon: MapPin,
    badge: "bg-blue-50 text-blue-700",
  },
  edutrip: {
    label: "Edutrip",
    icon: GraduationCap,
    badge: "bg-amber-50 text-amber-700",
  },
} as const;

function FacilityThumb({ row }: { row: UnifiedFacilityRow }) {
  const meta = CATEGORY_META[row.category];
  const Icon = meta.icon;

  if (row.imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- R2 public URL / static seed asset
      <img
        src={row.imageUrl}
        alt={row.name}
        className="size-10 rounded-lg object-cover ring-1 ring-gray-200"
      />
    );
  }

  return (
    <span
      className={cn(
        "flex size-10 items-center justify-center rounded-lg",
        meta.badge,
      )}
      aria-hidden="true"
    >
      <Icon className="size-4" />
    </span>
  );
}

function SortIndicator({
  field,
  sort,
}: {
  field: SortField;
  sort: SortState;
}) {
  if (sort.field !== field) {
    return <ChevronsUpDown className="size-3.5 text-gray-300" aria-hidden="true" />;
  }
  return sort.direction === "asc" ? (
    <ArrowUp className="size-3.5 text-brand-700" aria-label="Menaik" />
  ) : (
    <ArrowDown className="size-3.5 text-brand-700" aria-label="Menurun" />
  );
}

function StatusSwitch({
  row,
  disabled,
  onToggle,
}: {
  row: UnifiedFacilityRow;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={row.isActive}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      title={
        row.isActive ? "Klik untuk menonaktifkan" : "Klik untuk mengaktifkan"
      }
      aria-label={
        row.isActive ? `Nonaktifkan ${row.name}` : `Aktifkan ${row.name}`
      }
      className={cn(
        "relative h-[22px] w-10 shrink-0 rounded-full transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
        "disabled:cursor-not-allowed disabled:opacity-50",
        row.isActive
          ? "cursor-pointer bg-brand-600 hover:bg-brand-700"
          : "cursor-pointer bg-gray-200 hover:bg-gray-300",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute top-[3px] left-[3px] size-4 rounded-full bg-white shadow transition-transform",
          row.isActive && "translate-x-[18px]",
        )}
      />
    </button>
  );
}

export function FacilitiesTable({ rows }: { rows: UnifiedFacilityRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState<
    FacilityCategory[]
  >([]);
  const [selectedStatuses, setSelectedStatuses] = useState<StatusSelection[]>(
    [],
  );
  const [sort, setSort] = useState<SortState>({ field: null, direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_PAGE_SIZE);
  const [isPending, startTransition] = useTransition();

  function toggleCategory(category: FacilityCategory) {
    setPage(1);
    setSelectedCategories((prev) =>
      prev.includes(category)
        ? prev.filter((c) => c !== category)
        : [...prev, category],
    );
  }

  function toggleStatus(status: StatusSelection) {
    setPage(1);
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  }

  function selectSort(field: SortField) {
    setPage(1);
    setSort((prev) => {
      if (prev.field !== field) {
        // "Terbaru" naturally starts with newest first.
        return { field, direction: field === "createdAt" ? "desc" : "asc" };
      }
      return {
        field,
        direction: prev.direction === "asc" ? "desc" : "asc",
      };
    });
  }

  function selectPageSize(size: number) {
    setPageSize(size);
    setPage(1);
  }

  function clearAll() {
    setQuery("");
    setSelectedCategories([]);
    setSelectedStatuses([]);
    setSort({ field: null, direction: "asc" });
    setPageSize(DEFAULT_PAGE_SIZE);
    setPage(1);
  }

  const categoryActive =
    selectedCategories.length > 0 && selectedCategories.length < 3;
  const statusActive = selectedStatuses.length === 1;
  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (categoryActive ? 1 : 0) +
    (statusActive ? 1 : 0) +
    (sort.field ? 1 : 0);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (
          selectedCategories.length > 0 &&
          !selectedCategories.includes(row.category)
        ) {
          return false;
        }
        if (selectedStatuses.length > 0) {
          const isActive = selectedStatuses.includes("active") && row.isActive;
          const isInactive =
            selectedStatuses.includes("inactive") && !row.isActive;
          if (!isActive && !isInactive) return false;
        }
        if (
          query.trim() &&
          !row.name.toLowerCase().includes(query.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [rows, selectedCategories, selectedStatuses, query],
  );

  const sorted = useMemo(() => {
    if (!sort.field) return visible;
    const dir = sort.direction === "asc" ? 1 : -1;

    return [...visible].sort((a, b) => {
      switch (sort.field) {
        case "name":
          return a.name.localeCompare(b.name, "id") * dir;
        case "category":
          return a.categoryLabel.localeCompare(b.categoryLabel, "id") * dir;
        case "capacity":
          return (a.capacityMax - b.capacityMax) * dir;
        case "price":
          return (a.priceAmount - b.priceAmount) * dir;
        case "status":
          // Alphabetical order: "Aktif" before "Nonaktif".
          return (Number(b.isActive) - Number(a.isActive)) * dir;
        case "createdAt":
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            dir
          );
        default:
          return 0;
      }
    });
  }, [visible, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paged = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const start = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, sorted.length);

  function openEdit(row: UnifiedFacilityRow) {
    router.push(`/admin/facilities/${row.category}/${row.id}/edit`);
  }

  function sortableHeader(label: string, field: SortField) {
    return (
      <button
        type="button"
        onClick={() => selectSort(field)}
        title={`Urutkan berdasarkan ${label.toLowerCase()}`}
        className="inline-flex items-center gap-1 transition-colors hover:text-gray-700"
      >
        {label}
        <SortIndicator field={field} sort={sort} />
      </button>
    );
  }

  return (
    // No overflow-hidden here - the filter panel is absolutely positioned
    // and would be clipped when the table is short (e.g. a single filtered
    // row). Horizontal clipping stays on the scroll wrapper below instead.
    <Card>
      <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 p-4">
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            placeholder="Cari nama fasilitas..."
            className="h-9 w-56 rounded-lg border border-gray-200 bg-white pr-3 pl-9 text-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
          />
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setPanelOpen((value) => !value)}
            aria-expanded={panelOpen}
            aria-haspopup="dialog"
            className={cn(
              "inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors",
              panelOpen || activeFilterCount > 0
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            )}
          >
            <Funnel className="size-4" />
            Filter
            {activeFilterCount > 0 ? (
              <span className="flex size-5 items-center justify-center rounded-full bg-brand-700 text-[11px] font-semibold text-white">
                {activeFilterCount}
              </span>
            ) : null}
          </button>

          <FacilitiesFilterPanel
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            selectedCategories={selectedCategories}
            onToggleCategory={toggleCategory}
            selectedStatuses={selectedStatuses}
            onToggleStatus={toggleStatus}
            sort={sort}
            onSelectSort={selectSort}
            onClearAll={clearAll}
            activeCount={activeFilterCount}
            pageSize={pageSize}
            onSelectPageSize={selectPageSize}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-b-xl">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50 text-xs tracking-wide text-gray-400 uppercase">
            <tr>
              <th className="hidden px-4 py-3 sm:table-cell">Foto</th>
              <th className="px-4 py-3">{sortableHeader("Nama", "name")}</th>
              <th className="hidden px-4 py-3 md:table-cell">
                {sortableHeader("Kategori", "category")}
              </th>
              <th className="hidden px-4 py-3 lg:table-cell">
                {sortableHeader("Kapasitas", "capacity")}
              </th>
              <th className="hidden px-4 py-3 lg:table-cell">
                {sortableHeader("Harga", "price")}
              </th>
              <th className="px-4 py-3">{sortableHeader("Status", "status")}</th>
              <th className="w-12 px-4 py-3">
                <span className="sr-only">Hapus</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((row) => {
              const meta = CATEGORY_META[row.category];

              return (
                <tr
                  key={`${row.category}:${row.id}`}
                  onClick={() => openEdit(row)}
                  title="Klik untuk mengedit"
                  className="cursor-pointer transition-colors hover:bg-gray-50/70"
                >
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <FacilityThumb row={row} />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/facilities/${row.category}/${row.id}/edit`}
                      className="font-medium text-gray-900 hover:text-brand-700 hover:underline"
                    >
                      {row.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-gray-500 md:hidden">
                      {meta.label}
                      <span className="lg:hidden"> · {row.capacityLabel}</span>
                    </p>
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                        meta.badge,
                      )}
                    >
                      {meta.label}
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-gray-500 lg:table-cell">
                    {row.capacityLabel}
                  </td>
                  <td className="hidden px-4 py-3 whitespace-nowrap text-gray-500 tabular-nums lg:table-cell">
                    {row.priceLabel}
                  </td>
                  <td className="px-4 py-3">
                    <StatusSwitch
                      row={row}
                      disabled={isPending}
                      onToggle={() =>
                        startTransition(() =>
                          toggleFacilityActive(
                            row.category,
                            row.id,
                            !row.isActive,
                          ),
                        )
                      }
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={(event) => {
                          event.stopPropagation();
                          if (
                            !confirm(
                              `Hapus ${row.name}? Tindakan ini tidak dapat dibatalkan.`,
                            )
                          ) {
                            return;
                          }
                          startTransition(() =>
                            deleteFacility(row.category, row.id),
                          );
                        }}
                        aria-label={`Hapus ${row.name}`}
                        title="Hapus fasilitas"
                        className="rounded-md border border-gray-200 p-1.5 text-red-500 transition-colors hover:border-red-300 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {paged.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center">
                  <SearchX className="mx-auto size-8 text-gray-300" />
                  <p className="mt-3 text-sm font-medium text-gray-700">
                    Tidak ada fasilitas yang cocok
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Coba ubah kata kunci atau filter yang dipakai.
                  </p>
                  {activeFilterCount > 0 ? (
                    <button
                      type="button"
                      onClick={clearAll}
                      className="mt-4 text-xs font-medium text-brand-700 transition-colors hover:text-brand-800 hover:underline"
                    >
                      Bersihkan semua
                    </button>
                  ) : null}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <ClientPagination
        page={safePage}
        totalPages={totalPages}
        total={sorted.length}
        start={start}
        end={end}
        label="fasilitas"
        onPageChange={setPage}
      />
    </Card>
  );
}
