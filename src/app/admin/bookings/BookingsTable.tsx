"use client";

import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatShortDate } from "@/lib/utils/format";
import { adminCheckIn } from "@/features/bookings/actions";
import type { UnifiedBookingRow } from "@/features/bookings/service";

const tabs = ["All", "Pending", "Confirmed", "Completed"] as const;

function statusTone(status: string) {
  if (status === "COMPLETED") return "info" as const;
  if (status === "CONFIRMED") return "success" as const;
  if (status === "CANCELLED") return "danger" as const;
  return "warning" as const;
}

export function BookingsTable({ rows }: { rows: UnifiedBookingRow[] }) {
  const [tab, setTab] = useState<(typeof tabs)[number]>("All");
  const [query, setQuery] = useState("");
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(
    () =>
      rows.filter((row) => {
        if (tab !== "All" && row.bookingStatus !== tab.toUpperCase()) {
          return false;
        }
        if (
          query &&
          !`${row.invoiceNumber} ${row.visitorName} ${row.facilityName}`
            .toLowerCase()
            .includes(query.toLowerCase())
        ) {
          return false;
        }
        return true;
      }),
    [rows, tab, query],
  );

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 p-4">
        <input
          placeholder="Search by invoice, name, or facility"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-72 rounded-md border border-gray-200 px-3 py-1.5 text-sm"
        />
        <div className="flex gap-1 rounded-full bg-gray-100 p-1 text-sm">
          {tabs.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`rounded-full px-3 py-1 ${
                tab === t ? "bg-brand-700 text-white" : "text-gray-500"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-400">
          <tr>
            <th className="px-4 py-3">Invoice</th>
            <th className="px-4 py-3">Visitor</th>
            <th className="px-4 py-3">Facility</th>
            <th className="px-4 py-3">Date</th>
            <th className="px-4 py-3">Payment</th>
            <th className="px-4 py-3">Status</th>
            <th className="px-4 py-3 text-right">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {filtered.map((row) => (
            <tr key={`${row.bookingType}:${row.bookingId}`}>
              <td className="px-4 py-3 font-medium text-brand-700">
                {row.invoiceNumber}
              </td>
              <td className="px-4 py-3 text-gray-700">{row.visitorName}</td>
              <td className="px-4 py-3 text-gray-500">
                {row.facilityName}
                <span className="ml-1 text-xs text-gray-400">
                  ({row.timeLabel})
                </span>
              </td>
              <td className="px-4 py-3 text-gray-500">
                {formatShortDate(row.date)}
              </td>
              <td className="px-4 py-3">
                <Badge tone={row.paymentStatus === "PAID" ? "success" : "warning"}>
                  {row.paymentStatus}
                </Badge>
              </td>
              <td className="px-4 py-3">
                <Badge tone={statusTone(row.bookingStatus)}>
                  {row.bookingStatus}
                </Badge>
              </td>
              <td className="px-4 py-3 text-right">
                {row.bookingStatus === "CONFIRMED" ? (
                  <Button
                    size="sm"
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
                ) : (
                  <span className="text-xs text-gray-300">-</span>
                )}
              </td>
            </tr>
          ))}
          {filtered.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                No bookings match this filter.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Card>
  );
}
