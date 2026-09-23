"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import {
  deleteFacility,
  toggleFacilityActive,
} from "@/features/facilities/actions";
import type { UnifiedFacilityRow } from "@/features/facilities/service";

type CategoryFilter = "all" | "homestay" | "venue" | "edutrip";

export function FacilitiesTable({ rows }: { rows: UnifiedFacilityRow[] }) {
  const [category, setCategory] = useState<CategoryFilter>("all");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (category !== "all" && row.category !== category) return false;
        if (status === "active" && !row.isActive) return false;
        if (status === "inactive" && row.isActive) return false;
        return true;
      }),
    [rows, category, status],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
        <div className="flex gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as typeof category)}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm capitalize"
          >
            <option value="all">All Categories</option>
            <option value="homestay">Homestay</option>
            <option value="venue">Meeting Point</option>
            <option value="edutrip">Edutrip</option>
          </select>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as typeof status)}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-sm capitalize"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <span className="text-xs text-gray-400">
          Showing {filtered.length} of {rows.length} facilities
        </span>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-400">
          <tr>
            <th className="px-4 py-3">Name</th>
            <th className="px-4 py-3">Category</th>
            <th className="px-4 py-3">Capacity</th>
            <th className="px-4 py-3">Price</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map((row) => (
            <tr key={`${row.category}:${row.id}`}>
              <td className="px-4 py-3 font-medium text-gray-900">
                {row.name}
              </td>
              <td className="px-4 py-3 text-gray-500">{row.categoryLabel}</td>
              <td className="px-4 py-3 text-gray-500">{row.capacityLabel}</td>
              <td className="px-4 py-3 text-gray-500">{row.priceLabel}</td>
              <td className="px-4 py-3">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() =>
                    startTransition(() =>
                      toggleFacilityActive(row.category, row.id, !row.isActive),
                    )
                  }
                >
                  <Badge tone={row.isActive ? "success" : "neutral"}>
                    {row.isActive ? "Active" : "Inactive"}
                  </Badge>
                </button>
              </td>
              <td className="px-4 py-3">
                <div className="flex justify-end gap-2">
                  <Link
                    href={`/admin/facilities/${row.category}/${row.id}/edit`}
                    className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
                  >
                    <Pencil className="size-4" />
                  </Link>
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => {
                      if (!confirm(`Delete ${row.name}?`)) return;
                      startTransition(() =>
                        deleteFacility(row.category, row.id),
                      );
                    }}
                    className="rounded p-1.5 text-red-500 hover:bg-red-50"
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                No facilities match this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>
  );
}
