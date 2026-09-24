"use client";

import { useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { getTodayInJakarta } from "@/lib/siteConfig";

type Preset = "today" | "yesterday" | "7d" | "month" | "lastMonth";

function presetRange(preset: Preset): { from: string; to: string } {
  const todayStr = getTodayInJakarta();
  const [y, m, d] = todayStr.split("-").map(Number);
  const today = new Date(Date.UTC(y, m - 1, d));
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  if (preset === "today") return { from: todayStr, to: todayStr };
  if (preset === "yesterday") {
    const yest = new Date(today);
    yest.setUTCDate(yest.getUTCDate() - 1);
    return { from: iso(yest), to: iso(yest) };
  }
  if (preset === "7d") {
    const start = new Date(today);
    start.setUTCDate(start.getUTCDate() - 6);
    return { from: iso(start), to: todayStr };
  }
  if (preset === "month") {
    const start = new Date(Date.UTC(y, m - 1, 1));
    return { from: iso(start), to: todayStr };
  }
  // lastMonth
  const start = new Date(Date.UTC(y, m - 2, 1));
  const end = new Date(Date.UTC(y, m - 1, 0));
  return { from: iso(start), to: iso(end) };
}

/**
 * Reusable admin date-range filter (section 16/17) - reads/writes `from`/
 * `to` URL search params, computed against WIB calendar dates so presets
 * like "Today" match the same day the rest of the admin UI already shows.
 * `paramPrefix` lets a page with multiple date dimensions (e.g. KTR's
 * detection date vs. resolution date) mount two independent instances.
 */
export function DateRangeFilter({
  paramPrefix = "",
  label = "Date",
}: {
  paramPrefix?: string;
  label?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const fromKey = `${paramPrefix}from`;
  const toKey = `${paramPrefix}to`;

  const [from, setFrom] = useState(searchParams.get(fromKey) ?? "");
  const [to, setTo] = useState(searchParams.get(toKey) ?? "");

  function apply(nextFrom: string, nextTo: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (nextFrom) next.set(fromKey, nextFrom);
    else next.delete(fromKey);
    if (nextTo) next.set(toKey, nextTo);
    else next.delete(toKey);
    next.set("page", "1");
    router.push(`${pathname}?${next.toString()}`);
  }

  function applyPreset(preset: Preset) {
    const range = presetRange(preset);
    setFrom(range.from);
    setTo(range.to);
    apply(range.from, range.to);
  }

  function clear() {
    setFrom("");
    setTo("");
    apply("", "");
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-gray-500">
        {label} from
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="mt-1 block rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        />
      </label>
      <label className="text-xs text-gray-500">
        to
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="mt-1 block rounded-md border border-gray-200 px-2 py-1.5 text-sm"
        />
      </label>
      <Button size="sm" variant="outline" onClick={() => apply(from, to)}>
        <CalendarRange className="size-4" />
        Apply
      </Button>
      {from || to ? (
        <Button size="sm" variant="ghost" onClick={clear}>
          Clear
        </Button>
      ) : null}
      <div className="flex flex-wrap gap-1">
        {(
          [
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["7d", "Last 7 Days"],
            ["month", "This Month"],
            ["lastMonth", "Last Month"],
          ] as [Preset, string][]
        ).map(([preset, presetLabel]) => (
          <button
            key={preset}
            type="button"
            onClick={() => applyPreset(preset)}
            className="rounded-md border border-gray-200 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
          >
            {presetLabel}
          </button>
        ))}
      </div>
    </div>
  );
}
