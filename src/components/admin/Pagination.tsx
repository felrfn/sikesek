"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE_OPTIONS, type PaginationMeta } from "@/lib/utils/adminQuery";

/**
 * Reusable server-side pagination control - reads/writes the `page`/
 * `pageSize` URL search params so the server component re-fetches the
 * correct slice on navigation. Only mounted when there's something to
 * paginate (see the min(5, totalPages) window below for the page-number
 * list); the parent page owns the actual data fetch.
 */
export function Pagination({ meta }: { meta: PaginationMeta }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(params: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(params)) next.set(key, value);
    router.push(`${pathname}?${next.toString()}`);
  }

  const { page, totalPages, pageSize, total } = meta;
  if (total === 0) return null;

  const windowStart = Math.max(1, Math.min(page - 2, totalPages - 4));
  const pageNumbers = Array.from(
    { length: Math.min(5, totalPages) },
    (_, i) => windowStart + i,
  ).filter((n) => n >= 1 && n <= totalPages);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-100 px-4 py-3 text-sm">
      <div className="flex items-center gap-2 text-gray-500">
        <span>
          Showing {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
        </span>
        <select
          value={pageSize}
          onChange={(e) => go({ pageSize: e.target.value, page: "1" })}
          className="rounded-md border border-gray-200 px-2 py-1 text-xs"
        >
          {PAGE_SIZE_OPTIONS.map((size) => (
            <option key={size} value={size}>
              {size} / page
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => go({ page: String(page - 1) })}
          className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </button>
        {pageNumbers.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => go({ page: String(n) })}
            className={`rounded-md px-2.5 py-1 ${
              n === page
                ? "bg-brand-700 text-white"
                : "text-gray-600 hover:bg-gray-50"
            }`}
          >
            {n}
          </button>
        ))}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => go({ page: String(page + 1) })}
          className="flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
