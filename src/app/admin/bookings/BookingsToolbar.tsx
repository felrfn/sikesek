import type { ReactNode } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  ALL_BOOKING_STATUSES,
  rangeLabel,
  shiftRange,
  type ScheduleBookingType,
  type ScheduleView,
} from "@/features/bookings/schedule";

const BOOKING_TYPES: ScheduleBookingType[] = ["homestay", "venue", "edutrip"];
const VIEWS: ScheduleView[] = ["day", "week", "month"];

const TYPE_LABELS: Record<ScheduleBookingType, string> = {
  homestay: "Homestay",
  venue: "Venue",
  edutrip: "Edutrip",
};

const VIEW_LABELS: Record<ScheduleView, string> = {
  day: "Day",
  week: "Week",
  month: "Month",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  CHECKED_IN: "Checked in",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
};

function statusTone(status: string) {
  if (status === "CONFIRMED") return "bg-green-100 text-green-700";
  if (status === "CHECKED_IN") return "bg-emerald-100 text-emerald-700";
  if (status === "COMPLETED") return "bg-blue-100 text-blue-700";
  if (status === "CANCELLED" || status === "REJECTED") return "bg-red-100 text-red-700";
  return "bg-amber-100 text-amber-700";
}

function Segmented({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-full bg-gray-100 p-1 text-xs">
      {children}
    </div>
  );
}

function TabLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-full px-2.5 py-1 transition-colors",
        active ? "bg-brand-700 text-white" : "text-gray-500 hover:text-gray-700",
      )}
    >
      {children}
    </Link>
  );
}

export function BookingsToolbar({
  mode,
  bookingType,
  view,
  fromKey,
  toKey,
  anchorKey,
  todayKey,
  statuses,
}: {
  mode: "chart" | "list";
  bookingType: ScheduleBookingType;
  view: ScheduleView;
  fromKey: string;
  toKey: string;
  anchorKey: string;
  todayKey: string;
  statuses: string[];
}) {
  function href(overrides: {
    mode?: "chart" | "list";
    type?: ScheduleBookingType;
    view?: ScheduleView;
    date?: string;
    statuses?: string[];
  }) {
    const params = new URLSearchParams();
    params.set("mode", overrides.mode ?? mode);
    params.set("type", overrides.type ?? bookingType);
    params.set("view", overrides.view ?? view);
    params.set("date", overrides.date ?? anchorKey);
    const nextStatuses = overrides.statuses ?? statuses;
    if (nextStatuses.length > 0) params.set("statuses", nextStatuses.join(","));
    return `/admin/bookings?${params.toString()}`;
  }

  const previous = shiftRange(view, fromKey, -1);
  const next = shiftRange(view, fromKey, 1);
  const isChart = mode === "chart";

  function toggleStatus(status: string) {
    const selected = new Set(statuses);
    if (selected.has(status)) selected.delete(status);
    else selected.add(status);

    return href({
      statuses: ALL_BOOKING_STATUSES.filter((candidate) => selected.has(candidate)),
    });
  }

  return (
    <div className="mt-5 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Segmented>
            <TabLink href={href({ mode: "chart" })} active={mode === "chart"}>
              Chart
            </TabLink>
            <TabLink href={href({ mode: "list" })} active={mode === "list"}>
              List
            </TabLink>
          </Segmented>

          {isChart ? (
            <>
              <Segmented>
                {BOOKING_TYPES.map((candidate) => (
                  <TabLink
                    key={candidate}
                    href={href({ type: candidate })}
                    active={bookingType === candidate}
                  >
                    {TYPE_LABELS[candidate]}
                  </TabLink>
                ))}
              </Segmented>

              <Segmented>
                {VIEWS.map((candidate) => (
                  <TabLink
                    key={candidate}
                    href={href({ view: candidate })}
                    active={view === candidate}
                  >
                    {VIEW_LABELS[candidate]}
                  </TabLink>
                ))}
              </Segmented>
            </>
          ) : null}
        </div>

        {isChart ? (
          <div className="flex items-center gap-2">
            <Link
              href={href({ date: previous.from })}
              className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
              aria-label="Previous range"
            >
              <ChevronLeft className="size-4" />
            </Link>
            <span className="min-w-44 text-center text-sm font-medium text-gray-700">
              {rangeLabel(view, fromKey, toKey)}
            </span>
            <Link
              href={href({ date: next.from })}
              className="rounded-md border border-gray-200 p-1.5 text-gray-500 hover:bg-gray-50"
              aria-label="Next range"
            >
              <ChevronRight className="size-4" />
            </Link>
            <Link
              href={href({ date: todayKey })}
              className="rounded-md border border-gray-200 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-50"
            >
              Today
            </Link>
          </div>
        ) : null}
      </div>

      {isChart ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-gray-400">Status</span>
          {ALL_BOOKING_STATUSES.map((status) => {
            const selected = statuses.includes(status);
            return (
              <Link
                key={status}
                href={toggleStatus(status)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                  selected ? statusTone(status) : "bg-gray-100 text-gray-400",
                )}
              >
                {STATUS_LABELS[status]}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
