import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { formatHour } from "@/lib/utils/format";
import {
  barVariant,
  type BarVariant,
  type ScheduleBooking,
  type ScheduleBookingType,
  type ScheduleDay,
  type ScheduleRow,
  type ScheduleView,
} from "@/features/bookings/schedule";

const WEEKDAYS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

const variantClasses: Record<BarVariant, string> = {
  pending: "border-amber-300 bg-amber-100 text-amber-900",
  pendingPaid: "border-blue-300 bg-blue-100 text-blue-900",
  confirmed: "border-green-300 bg-green-100 text-green-900",
  checkedIn: "border-emerald-500 bg-emerald-600 text-white",
  completed: "border-gray-300 bg-gray-100 text-gray-600",
  cancelled: "border-red-200 bg-red-50 text-red-500 line-through",
};

const legend: { variant: BarVariant; label: string }[] = [
  { variant: "pending", label: "Pending" },
  { variant: "pendingPaid", label: "Paid, awaiting confirm" },
  { variant: "confirmed", label: "Confirmed" },
  { variant: "checkedIn", label: "Checked in" },
  { variant: "completed", label: "Completed" },
  { variant: "cancelled", label: "Cancelled / rejected" },
];

function timeLabel(booking: ScheduleBooking) {
  if (booking.startHour !== undefined && booking.endHour !== undefined) {
    return `${formatHour(booking.startHour)}-${formatHour(booking.endHour)}`;
  }
  if (booking.nights !== undefined) return `${booking.nights} malam`;
  if (booking.pax !== undefined) return `${booking.pax} pax`;
  return "";
}

function tooltipFor(booking: ScheduleBooking) {
  const date =
    booking.bookingType === "homestay"
      ? `${booking.startKey} -> ${booking.endKey}`
      : booking.startKey;
  return [
    `${booking.invoiceNumber} - ${booking.customerName}`,
    date,
    timeLabel(booking),
    `${booking.bookingStatus.replace("_", " ")} - ${booking.paymentStatus}${
      booking.paymentOverdue ? " (overdue)" : ""
    }`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function BookingGantt({
  rows,
  days,
  view,
  bookingType,
}: {
  rows: ScheduleRow[];
  days: ScheduleDay[];
  view: ScheduleView;
  bookingType: ScheduleBookingType;
}) {
  if (rows.length === 0) {
    return (
      <Card className="p-10 text-center text-sm text-gray-400">
        No facilities found for this booking type.
      </Card>
    );
  }

  const isHourView = view === "day" && bookingType === "venue";
  const columnCount = isHourView ? 24 : Math.max(1, days.length);
  const dayCount = Math.max(1, days.length);
  const gridTemplateColumns = `repeat(${columnCount}, minmax(0, 1fr))`;
  const trackMinWidth = isHourView ? 720 : Math.max(640, dayCount * 40);
  const showWeekday = view !== "month";

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        {/* Header */}
        <div className="flex border-b border-gray-200 bg-white">
          <div className="sticky left-0 z-20 w-56 shrink-0 border-r border-gray-200 bg-white px-4 py-2 text-xs font-medium uppercase tracking-wide text-gray-400">
            Facility
          </div>
          <div className="flex-1" style={{ minWidth: trackMinWidth }}>
            {isHourView ? (
              <div className="grid" style={{ gridTemplateColumns }}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div
                    key={hour}
                    className="border-r border-gray-100 py-2 text-center text-[10px] text-gray-400"
                  >
                    {String(hour).padStart(2, "0")}
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid" style={{ gridTemplateColumns }}>
                {days.map((day) => (
                  <div
                    key={day.key}
                    className={cn(
                      "border-r border-gray-100 px-1 py-2 text-center",
                      day.isToday && "bg-brand-50",
                      day.isClosedHoliday && "bg-red-50",
                      !day.isToday &&
                        !day.isClosedHoliday &&
                        day.isWeekend &&
                        "bg-gray-50",
                    )}
                  >
                    {showWeekday ? (
                      <p
                        className={cn(
                          "text-[10px] uppercase",
                          day.isToday
                            ? "font-semibold text-brand-700"
                            : "text-gray-400",
                        )}
                      >
                        {WEEKDAYS[day.weekday]}
                      </p>
                    ) : null}
                    <p
                      className={cn(
                        "text-sm",
                        day.isToday
                          ? "font-bold text-brand-700"
                          : "text-gray-700",
                      )}
                    >
                      {day.dayOfMonth}
                    </p>
                    {day.holidayName ? (
                      <p
                        className="truncate text-[9px] text-red-500"
                        title={day.holidayName}
                      >
                        {showWeekday ? day.holidayName : "\u2022"}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Facility rows */}
        {rows.map((row) => {
          const rowHeight = Math.max(1, row.lanes) * 34 + 16;

          return (
            <div
              key={row.facility.id}
              className="flex border-b border-gray-100 last:border-b-0"
            >
              <div className="sticky left-0 z-20 w-56 shrink-0 border-r border-gray-200 bg-white px-4 py-3">
                <p
                  className="truncate text-sm font-medium text-gray-800"
                  title={row.facility.name}
                >
                  {row.facility.name}
                </p>
                <p
                  className="truncate text-xs text-gray-400"
                  title={row.facility.meta}
                >
                  {row.facility.meta}
                </p>
                {!row.facility.isActive ? (
                  <Badge tone="neutral" className="mt-1">
                    Inactive
                  </Badge>
                ) : null}
              </div>

              <div
                className="relative flex-1 overflow-hidden"
                style={{ minWidth: trackMinWidth, height: rowHeight }}
              >
                {/* Column backgrounds */}
                <div
                  className="absolute inset-0 grid"
                  style={{ gridTemplateColumns }}
                >
                  {isHourView
                    ? Array.from({ length: 24 }, (_, hour) => (
                        <div
                          key={hour}
                          className="border-r border-gray-100"
                        />
                      ))
                    : days.map((day) => (
                        <div
                          key={day.key}
                          className={cn(
                            "border-r border-gray-100",
                            day.isToday && "bg-brand-50/60",
                            day.isClosedHoliday && "bg-red-50/70",
                            !day.isToday &&
                              !day.isClosedHoliday &&
                              day.isWeekend &&
                              "bg-gray-50/70",
                          )}
                        />
                      ))}
                </div>

                {/* Positioned bars */}
                {row.bars.map((bar) => {
                  const left = (bar.startUnits / dayCount) * 100;
                  const width = (bar.endUnits - bar.startUnits) / dayCount * 100;
                  const duration = timeLabel(bar);

                  return (
                    <Link
                      key={bar.id}
                      href={`/admin/bookings/${bar.bookingType}/${bar.id}`}
                      title={tooltipFor(bar)}
                      aria-label={`${bar.invoiceNumber}, ${bar.customerName}`}
                      className={cn(
                        "absolute flex items-center gap-1 overflow-hidden rounded border px-1.5 text-[11px] font-medium shadow-sm transition hover:brightness-95",
                        variantClasses[barVariant(bar)],
                      )}
                      style={{
                        left: `${left}%`,
                        width: `calc(${width}% - 2px)`,
                        marginLeft: "1px",
                        top: `${8 + bar.lane * 34}px`,
                        height: "28px",
                      }}
                    >
                      <span className="truncate">{bar.customerName}</span>
                      {duration ? (
                        <span className="hidden shrink-0 text-[10px] opacity-70 sm:inline">
                          {duration}
                        </span>
                      ) : null}
                      {bar.clippedStart ? <span>…</span> : null}
                      {bar.clippedEnd ? <span>…</span> : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-gray-100 bg-gray-50/60 px-4 py-2.5 text-xs text-gray-500">
        {legend.map((item) => (
          <span key={item.variant} className="inline-flex items-center gap-1.5">
            <span
              className={cn(
                "size-2.5 rounded-sm border",
                variantClasses[item.variant],
              )}
            />
            {item.label}
          </span>
        ))}
      </div>
    </Card>
  );
}
