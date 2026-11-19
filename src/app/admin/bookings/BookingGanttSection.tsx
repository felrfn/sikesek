import Link from "next/link";
import { ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import {
  rangeLabel,
  shiftRange,
  type ScheduleBookingType,
  type ScheduleDay,
  type ScheduleRow,
  type ScheduleView,
} from "@/features/bookings/schedule";
import { BOOKING_TYPE_META } from "@/features/bookings/display";
import { BookingGantt } from "./BookingGantt";

const VIEWS: ScheduleView[] = ["day", "week", "month"];

const VIEW_LABELS: Record<ScheduleView, string> = {
  day: "Hari",
  week: "Minggu",
  month: "Bulan",
};

const TYPE_PREFIX: Record<ScheduleBookingType, string> = {
  homestay: "h",
  venue: "v",
  edutrip: "e",
};

export interface ChartQuery {
  types: string;
  statuses: string;
  showInactive: string;
  hDate: string;
  hView: ScheduleView;
  vDate: string;
  vView: ScheduleView;
  eDate: string;
  eView: ScheduleView;
}

/**
 * One self-contained Gantt section (Homestay / Venue / Edutrip): its own
 * title, booking count, view switcher, and date navigator. Every link
 * preserves the other sections' date/view plus the shared mode, type, and
 * status filters, so sections navigate independently of each other.
 */
export function BookingGanttSection({
  bookingType,
  view,
  fromKey,
  toKey,
  todayKey,
  days,
  rows,
  query,
}: {
  bookingType: ScheduleBookingType;
  view: ScheduleView;
  fromKey: string;
  toKey: string;
  todayKey: string;
  days: ScheduleDay[];
  rows: ScheduleRow[];
  query: ChartQuery;
}) {
  const meta = BOOKING_TYPE_META[bookingType];
  const Icon: LucideIcon = meta.icon;
  const prefix = TYPE_PREFIX[bookingType];
  const dateParam = `${prefix}Date` as "hDate" | "vDate" | "eDate";
  const viewParam = `${prefix}View` as "hView" | "vView" | "eView";
  const reservationCount = rows.reduce((sum, row) => sum + row.bars.length, 0);

  function href(overrides?: { view?: ScheduleView; date?: string }) {
    const params = new URLSearchParams();
    params.set("mode", "chart");
    if (query.types) params.set("types", query.types);
    if (query.statuses) params.set("statuses", query.statuses);
    if (query.showInactive) params.set("showInactive", query.showInactive);
    params.set("hDate", query.hDate);
    params.set("hView", query.hView);
    params.set("vDate", query.vDate);
    params.set("vView", query.vView);
    params.set("eDate", query.eDate);
    params.set("eView", query.eView);
    params.set(dateParam, overrides?.date ?? query[dateParam]);
    params.set(viewParam, overrides?.view ?? query[viewParam]);
    return `/admin/bookings?${params.toString()}`;
  }

  const previous = shiftRange(view, fromKey, -1);
  const next = shiftRange(view, fromKey, 1);

  return (
    <section aria-label={`Grafik ${meta.label}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-lg",
              meta.badge,
            )}
          >
            <Icon className="size-4" />
          </span>
          <div>
            <h2 className="font-semibold text-gray-900">{meta.label}</h2>
            <p className="text-xs text-gray-500">
              {reservationCount} reservasi pada rentang ini
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1 rounded-full bg-gray-100 p-1 text-xs">
            {VIEWS.map((candidate) => (
              <Link
                key={candidate}
                href={href({ view: candidate })}
                aria-current={view === candidate ? "true" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-1 transition-colors",
                  view === candidate
                    ? "bg-brand-700 text-white"
                    : "text-gray-500 hover:text-gray-700",
                )}
              >
                {VIEW_LABELS[candidate]}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-1.5">
            <Link
              href={href({ date: previous.from })}
              className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 transition-colors hover:bg-gray-50"
              aria-label="Rentang sebelumnya"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-44 text-center text-sm font-medium text-gray-700">
              {rangeLabel(view, fromKey, toKey)}
            </span>
            <Link
              href={href({ date: next.from })}
              className="rounded-md border border-gray-200 bg-white p-1.5 text-gray-500 transition-colors hover:bg-gray-50"
              aria-label="Rentang berikutnya"
            >
              <ChevronRight className="size-4" />
            </Link>
            <Link
              href={href({ date: todayKey })}
              className="rounded-md border border-gray-200 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
            >
              Hari ini
            </Link>
          </div>
        </div>
      </div>

      <div className="mt-3">
        {reservationCount === 0 ? (
          <Card className="p-10 text-center text-sm text-gray-400">
            Belum ada reservasi pada rentang ini.
          </Card>
        ) : (
          <BookingGantt
            rows={rows}
            days={days}
            view={view}
            bookingType={bookingType}
          />
        )}
      </div>
    </section>
  );
}
