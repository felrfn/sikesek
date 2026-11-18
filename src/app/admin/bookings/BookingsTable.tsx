"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  ChevronsUpDown,
  Eye,
  Funnel,
  Search,
  SearchX,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ClientPagination } from "@/components/admin/ClientPagination";
import { cn } from "@/lib/utils/cn";
import { formatShortDate } from "@/lib/utils/format";
import { adminCheckIn, confirmBooking } from "@/features/bookings/actions";
import type {
  BookingType,
  UnifiedBookingRow,
} from "@/features/bookings/service";
import {
  BOOKING_TYPE_META,
  bookingStatusLabel,
  bookingStatusTone,
  paymentStatusLabel,
  paymentStatusTone,
} from "@/features/bookings/display";
import {
  BookingsListFilterPanel,
  DEFAULT_BOOKING_PAGE_SIZE,
  type BookingSortField,
  type BookingSortState,
} from "./BookingsListFilterPanel";

function SortIndicator({
  field,
  sort,
}: {
  field: BookingSortField;
  sort: BookingSortState;
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

export function BookingsTable({ rows }: { rows: UnifiedBookingRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [panelOpen, setPanelOpen] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<BookingType[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedPayments, setSelectedPayments] = useState<string[]>([]);
  const [sort, setSort] = useState<BookingSortState>({
    field: null,
    direction: "desc",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DEFAULT_BOOKING_PAGE_SIZE);
  const [isPending, startTransition] = useTransition();

  function toggleType(type: BookingType) {
    setPage(1);
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  }

  function toggleStatus(status: string) {
    setPage(1);
    setSelectedStatuses((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  }

  function togglePayment(status: string) {
    setPage(1);
    setSelectedPayments((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  }

  function selectSort(field: BookingSortField) {
    setPage(1);
    setSort((prev) => {
      if (prev.field !== field) {
        // Newest-first fields start descending.
        const direction =
          field === "date" || field === "createdAt" ? "desc" : "asc";
        return { field, direction };
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
    setSelectedTypes([]);
    setSelectedStatuses([]);
    setSelectedPayments([]);
    setSort({ field: null, direction: "desc" });
    setPageSize(DEFAULT_BOOKING_PAGE_SIZE);
    setPage(1);
  }

  const typeActive = selectedTypes.length > 0 && selectedTypes.length < 3;
  const statusActive =
    selectedStatuses.length > 0 && selectedStatuses.length < 6;
  const paymentActive = selectedPayments.length > 0;
  const activeFilterCount =
    (query.trim() ? 1 : 0) +
    (typeActive ? 1 : 0) +
    (statusActive ? 1 : 0) +
    (paymentActive ? 1 : 0) +
    (sort.field ? 1 : 0);

  const visible = useMemo(
    () =>
      rows.filter((row) => {
        if (selectedTypes.length > 0 && !selectedTypes.includes(row.bookingType)) {
          return false;
        }
        if (
          selectedStatuses.length > 0 &&
          !selectedStatuses.includes(row.bookingStatus)
        ) {
          return false;
        }
        if (
          selectedPayments.length > 0 &&
          !selectedPayments.includes(row.paymentStatus)
        ) {
          return false;
        }
        if (
          query.trim() &&
          !`${row.invoiceNumber} ${row.visitorName} ${row.facilityName}`
            .toLowerCase()
            .includes(query.trim().toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [rows, selectedTypes, selectedStatuses, selectedPayments, query],
  );

  const sorted = useMemo(() => {
    const dir = sort.direction === "asc" ? 1 : -1;
    const field = sort.field ?? "createdAt";

    return [...visible].sort((a, b) => {
      switch (field) {
        case "date":
          return (new Date(a.date).getTime() - new Date(b.date).getTime()) * dir;
        case "createdAt":
          return (
            (new Date(a.createdAt).getTime() -
              new Date(b.createdAt).getTime()) *
            dir
          );
        case "invoice":
          return a.invoiceNumber.localeCompare(b.invoiceNumber, "id") * dir;
        case "visitor":
          return a.visitorName.localeCompare(b.visitorName, "id") * dir;
        case "facility":
          return a.facilityName.localeCompare(b.facilityName, "id") * dir;
        case "status":
          return (
            bookingStatusLabel(a.bookingStatus).localeCompare(
              bookingStatusLabel(b.bookingStatus),
              "id",
            ) * dir
          );
        case "payment":
          return (
            paymentStatusLabel(a.paymentStatus).localeCompare(
              paymentStatusLabel(b.paymentStatus),
              "id",
            ) * dir
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

  function openDetail(row: UnifiedBookingRow) {
    router.push(`/admin/bookings/${row.bookingType}/${row.bookingId}`);
  }

  function sortableHeader(label: string, field: BookingSortField) {
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
            placeholder="Cari invoice, nama, atau fasilitas..."
            className="h-9 w-64 rounded-lg border border-gray-200 bg-white pr-3 pl-9 text-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
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

          <BookingsListFilterPanel
            open={panelOpen}
            onClose={() => setPanelOpen(false)}
            selectedTypes={selectedTypes}
            onToggleType={toggleType}
            selectedStatuses={selectedStatuses}
            onToggleStatus={toggleStatus}
            selectedPayments={selectedPayments}
            onTogglePayment={togglePayment}
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
              <th className="px-4 py-3">{sortableHeader("Invoice", "invoice")}</th>
              <th className="px-4 py-3">{sortableHeader("Tamu", "visitor")}</th>
              <th className="px-4 py-3">{sortableHeader("Fasilitas", "facility")}</th>
              <th className="px-4 py-3">{sortableHeader("Tanggal", "date")}</th>
              <th className="px-4 py-3">{sortableHeader("Pembayaran", "payment")}</th>
              <th className="px-4 py-3">{sortableHeader("Status", "status")}</th>
              <th className="px-4 py-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {paged.map((row) => {
              const typeMeta = BOOKING_TYPE_META[row.bookingType];

              return (
                <tr
                  key={`${row.bookingType}:${row.bookingId}`}
                  onClick={() => openDetail(row)}
                  title="Klik untuk melihat detail"
                  className="cursor-pointer transition-colors hover:bg-gray-50/70"
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap text-brand-700">
                    <Link
                      href={`/admin/bookings/${row.bookingType}/${row.bookingId}`}
                      className="hover:underline"
                    >
                      {row.invoiceNumber}
                    </Link>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {row.visitorName}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {row.facilityName}
                    <span className="ml-1 text-xs whitespace-nowrap text-gray-400">
                      ({row.timeLabel})
                    </span>
                    <span
                      className={cn(
                        "mt-1 hidden w-fit items-center rounded-full px-2 py-0.5 text-[11px] font-medium md:hidden",
                        typeMeta.badge,
                      )}
                    >
                      {typeMeta.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-gray-500">
                    {formatShortDate(row.date)}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={paymentStatusTone(row.paymentStatus)}>
                      {paymentStatusLabel(row.paymentStatus)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={bookingStatusTone(row.bookingStatus)}>
                      {bookingStatusLabel(row.bookingStatus)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <div
                      className="flex items-center justify-end gap-1.5"
                      onClick={(event) => event.stopPropagation()}
                    >
                      {row.bookingStatus === "PENDING" &&
                      row.paymentStatus === "PAID" ? (
                        <Button
                          size="sm"
                          className="whitespace-nowrap"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await confirmBooking(
                                row.bookingType,
                                row.bookingId,
                              );
                              if (result.error) alert(result.error);
                            })
                          }
                        >
                          Konfirmasi
                        </Button>
                      ) : null}
                      {row.bookingStatus === "CONFIRMED" ? (
                        <Button
                          size="sm"
                          className="whitespace-nowrap"
                          disabled={isPending}
                          onClick={() =>
                            startTransition(async () => {
                              const result = await adminCheckIn(
                                row.bookingType,
                                row.bookingId,
                              );
                              if (result.error) alert(result.error);
                            })
                          }
                        >
                          Check-in
                        </Button>
                      ) : null}
                      <Link
                        href={`/admin/bookings/${row.bookingType}/${row.bookingId}`}
                        aria-label={`Detail ${row.invoiceNumber}`}
                        title="Lihat detail"
                        className="rounded-md border border-gray-200 p-1.5 text-gray-500 transition-colors hover:border-brand-600 hover:text-brand-700"
                      >
                        <Eye className="size-4" />
                      </Link>
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
                    Tidak ada reservasi yang cocok
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
        label="reservasi"
        onPageChange={setPage}
      />
    </Card>
  );
}
