"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

/**
 * Shared client-side pagination footer for admin tables whose full dataset
 * is small enough to page in the browser (facilities, bookings). The server
 * sends every row once; filtering, sorting, and paging need no round-trips.
 * (The URL-driven `Pagination` in this same folder is for server-side paging
 * of large datasets like payments.)
 */
export function ClientPagination({
  page,
  totalPages,
  total,
  start,
  end,
  label,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  total: number;
  start: number;
  end: number;
  /** Indonesian plural noun, e.g. "fasilitas" or "reservasi". */
  label: string;
  onPageChange: (page: number) => void;
}) {
  if (total === 0) return null;

  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => windowStart + i,
  ).filter((n) => n >= 1 && n <= totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm">
      <p className="text-xs text-gray-500">
        Menampilkan {start}&ndash;{end} dari {total} {label}
      </p>

      {totalPages > 1 ? (
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            aria-label="Halaman sebelumnya"
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="size-3.5" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>
          {pageNumbers.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onPageChange(n)}
              aria-label={`Halaman ${n}`}
              aria-current={n === page ? "page" : undefined}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs transition-colors",
                n === page
                  ? "bg-brand-700 font-medium text-white"
                  : "text-gray-600 hover:bg-gray-50",
              )}
            >
              {n}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            aria-label="Halaman berikutnya"
            className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRight className="size-3.5" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
