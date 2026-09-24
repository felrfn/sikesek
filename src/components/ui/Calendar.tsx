"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const WEEKDAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const MONTH_LABELS = [
  "Januari",
  "Februari",
  "Maret",
  "April",
  "Mei",
  "Juni",
  "Juli",
  "Agustus",
  "September",
  "Oktober",
  "November",
  "Desember",
];

function parseIsoDate(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month: month - 1, day };
}

function toIso(year: number, month: number, day: number) {
  const mm = String(month + 1).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function firstWeekdayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/**
 * A self-contained month-grid date picker. `today` and `minDate` are
 * plain ISO date strings supplied by the caller (ultimately from a Server
 * Component) rather than computed here with `new Date()` - this is what
 * keeps the very first client render identical to the server-rendered
 * markup. See src/app/booking/page.tsx for where `today` originates.
 */
export function Calendar({
  value,
  onChange,
  today,
  minDate = today,
}: {
  value: string;
  onChange: (iso: string) => void;
  today: string;
  minDate?: string;
}) {
  const initial = parseIsoDate(value || today);
  const [viewYear, setViewYear] = useState(initial.year);
  const [viewMonth, setViewMonth] = useState(initial.month);

  const cells = useMemo(() => {
    const total = daysInMonth(viewYear, viewMonth);
    const offset = firstWeekdayOfMonth(viewYear, viewMonth);
    return [
      ...Array.from({ length: offset }, () => null),
      ...Array.from({ length: total }, (_, i) => i + 1),
    ];
  }, [viewYear, viewMonth]);

  const yearOptions = useMemo(() => {
    const base = parseIsoDate(today).year;
    return Array.from({ length: 6 }, (_, i) => base + i);
  }, [today]);

  function changeMonth(delta: number) {
    let month = viewMonth + delta;
    let year = viewYear;
    if (month < 0) {
      month = 11;
      year -= 1;
    } else if (month > 11) {
      month = 0;
      year += 1;
    }
    setViewMonth(month);
    setViewYear(year);
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => changeMonth(-1)}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Previous month"
        >
          <ChevronLeft className="size-4" />
        </button>

        <div className="flex items-center gap-2">
          <select
            value={viewMonth}
            onChange={(e) => setViewMonth(Number(e.target.value))}
            className="rounded-md border border-gray-200 px-2 py-1 text-sm"
          >
            {MONTH_LABELS.map((label, i) => (
              <option key={label} value={i}>
                {label}
              </option>
            ))}
          </select>
          <select
            value={viewYear}
            onChange={(e) => setViewYear(Number(e.target.value))}
            className="rounded-md border border-gray-200 px-2 py-1 text-sm"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => changeMonth(1)}
          className="rounded p-1.5 text-gray-500 hover:bg-gray-100"
          aria-label="Next month"
        >
          <ChevronRight className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="py-1">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, index) => {
          if (day === null) return <div key={`empty-${index}`} />;
          const iso = toIso(viewYear, viewMonth, day);
          const isPast = iso < minDate;
          const isSelected = iso === value;
          const isToday = iso === today;

          return (
            <button
              key={iso}
              type="button"
              disabled={isPast}
              onClick={() => onChange(iso)}
              className={cn(
                "aspect-square rounded-lg text-sm transition-colors",
                isSelected
                  ? "bg-brand-700 text-white"
                  : isPast
                    ? "cursor-not-allowed text-gray-300"
                    : "text-gray-700 hover:bg-brand-50",
                isToday && !isSelected ? "ring-1 ring-inset ring-brand-300" : "",
              )}
            >
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}
